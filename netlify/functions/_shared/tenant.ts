import { getPool } from './db';
import { requireUser } from './session';
import { ensureFreeSubscription } from './billing';
import { isPreviewDeployment } from './preview';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
}

export async function requireTenant(request: Request) {
  const user = await requireUser(request);
  if (!user) return null;

  const db = getPool();
  const membership = await db.query(
    `select om.organization_id,
            om.role,
            o.name as organization_name,
            o.slug,
            o.logo_url as organization_logo_url,
            p.full_name as profile_full_name
     from organization_members om
     join organizations o on o.id = om.organization_id
     left join profiles p on p.user_id = om.user_id
     where om.user_id = $1
     order by (p.active_organization_id = om.organization_id) desc, om.created_at asc
     limit 1`,
    [user.id]
  );

  if (membership.rowCount) return { user, ...membership.rows[0] };

  // A preview can read the workspace of an existing member, but must never
  // create a real organization as a side effect of loading the app.
  if (isPreviewDeployment(request)) return null;

  const baseName = user.name?.trim() || user.email?.split('@')[0] || 'My Organization';
  const suffix = String(user.id).slice(0, 8);
  const slug = `${slugify(baseName)}-${suffix}`;
  const client = await db.connect();

  try {
    await client.query('begin');
    const org = await client.query(
      `insert into organizations (name, slug) values ($1, $2)
       returning id, name, slug`,
      [`${baseName}'s Workspace`, slug]
    );
    const organization = org.rows[0];

    await client.query(
      `insert into organization_members (organization_id, user_id, role)
       values ($1, $2, 'owner')`,
      [organization.id, user.id]
    );
    await client.query(
      `insert into profiles (user_id, full_name, active_organization_id)
       values ($1, $2, $3)
       on conflict (user_id) do update set active_organization_id = excluded.active_organization_id`,
      [user.id, user.name || baseName, organization.id]
    );
    await ensureFreeSubscription(client, organization.id);
    await client.query('commit');

    return {
      user,
      organization_id: organization.id,
      organization_name: organization.name,
      organization_logo_url: null,
      profile_full_name: user.name || baseName,
      slug: organization.slug,
      role: 'owner',
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
