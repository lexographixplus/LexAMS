import { getPool } from './db';
import { requireUser } from './session';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
}

export async function requireTenant(request: Request) {
  const user = await requireUser(request);
  if (!user) return null;

  const db = getPool();
  const membership = await db.query(
    `select om.organization_id, om.role, o.name as organization_name, o.slug
     from organization_members om
     join organizations o on o.id = om.organization_id
     left join profiles p on p.user_id = om.user_id
     where om.user_id = $1
     order by (p.active_organization_id = om.organization_id) desc, om.created_at asc
     limit 1`,
    [user.id]
  );

  if (membership.rowCount) {
    return { user, ...membership.rows[0] };
  }

  const baseName = user.name?.trim() || user.email?.split('@')[0] || 'My Organization';
  const suffix = String(user.id).slice(0, 8);
  const slug = `${slugify(baseName)}-${suffix}`;

  await db.query('begin');
  try {
    const org = await db.query(
      `insert into organizations (name, slug) values ($1, $2)
       returning id, name, slug`,
      [`${baseName}'s Workspace`, slug]
    );
    const organization = org.rows[0];

    await db.query(
      `insert into organization_members (organization_id, user_id, role)
       values ($1, $2, 'owner')`,
      [organization.id, user.id]
    );
    await db.query(
      `insert into profiles (user_id, full_name, active_organization_id)
       values ($1, $2, $3)
       on conflict (user_id) do update set active_organization_id = excluded.active_organization_id`,
      [user.id, user.name || baseName, organization.id]
    );
    await db.query('commit');

    return {
      user,
      organization_id: organization.id,
      organization_name: organization.name,
      slug: organization.slug,
      role: 'owner',
    };
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}
