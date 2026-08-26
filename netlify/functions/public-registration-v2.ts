import type { Config, Context } from '@netlify/functions';
import { getPool } from './_shared/db';
import { assertCreationEntitlement } from './_shared/billing';
import { appBaseUrl, brandedEmail, sendEmailBatch } from './_shared/communications';
import { isPreviewDeployment, previewReadOnlyResponse } from './_shared/preview';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function cleanEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function customFields(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<Record<string, unknown>>;
  return value
    .filter(field => field && typeof field === 'object')
    .map((field: any, index) => ({
      id: String(field.id || `field_${index + 1}`).slice(0, 80),
      label: String(field.label || `Question ${index + 1}`).slice(0, 180),
      type: ['text', 'textarea', 'select', 'checkbox'].includes(String(field.type)) ? String(field.type) : 'text',
      required: Boolean(field.required),
      options: Array.isArray(field.options) ? field.options.map((option: unknown) => String(option).slice(0, 120)).slice(0, 30) : [],
    }));
}

function validateAnswers(fields: ReturnType<typeof customFields>, answers: any) {
  const safeAnswers: Record<string, unknown> = {};
  const source = answers && typeof answers === 'object' ? answers : {};
  for (const field of fields) {
    const raw = source[field.id];
    const value = field.type === 'checkbox' ? Boolean(raw) : String(raw ?? '').trim().slice(0, 2000);
    if (field.required && (field.type === 'checkbox' ? !value : !String(value).trim())) {
      throw new Error(`Please complete: ${field.label}`);
    }
    if (field.type === 'select' && value && field.options.length && !field.options.includes(String(value))) {
      throw new Error(`Choose a valid option for: ${field.label}`);
    }
    safeAnswers[field.id] = value;
  }
  return safeAnswers;
}

function registrationAvailability(activity: any) {
  const now = new Date();
  if (!activity.reg_open) return { open: false, reason: 'Registration is closed for this activity.' };
  if (activity.registration_opens_at && now < new Date(activity.registration_opens_at)) {
    return { open: false, reason: 'Registration is not open yet.' };
  }
  if (activity.registration_closes_at && now > new Date(activity.registration_closes_at)) {
    return { open: false, reason: 'Registration has closed for this activity.' };
  }
  return { open: true, reason: '' };
}

async function sendConfirmation(args: {
  request: Request;
  activity: any;
  participant: any;
  registration: any;
}) {
  if (!args.activity.registration_confirmation_email) return { attempted: false, sent: false };
  const statusLabel = args.registration.status === 'confirmed'
    ? 'confirmed'
    : args.registration.status === 'waitlisted'
      ? 'on the waitlist'
      : 'pending approval';
  const base = appBaseUrl(args.request);
  const passUrl = `${base}/pass/${args.participant.pass_token}`;
  const message = String(args.activity.registration_confirmation_message || '').trim();
  const body = [
    `Hello ${args.participant.name},`,
    `Your registration for ${args.activity.title} is ${statusLabel}.`,
    `Registration reference: ${args.registration.reference_code}`,
    message,
    args.registration.status === 'confirmed' ? 'Keep this reference or your participant pass available for check-in.' : '',
  ].filter(Boolean).join('\n\n');

  try {
    const result = await sendEmailBatch([{
      to: args.participant.email,
      subject: `${args.activity.title} registration ${statusLabel}`,
      html: brandedEmail({
        organizationName: args.activity.organization_name,
        logoUrl: args.activity.organization_logo,
        preview: `Registration ${statusLabel} for ${args.activity.title}`,
        heading: `Registration ${statusLabel}`,
        body,
        ctaLabel: 'View participant pass',
        ctaUrl: passUrl,
      }),
    }], `registration:${args.registration.id}:${args.registration.status}`);
    return { attempted: true, sent: result.sent > 0 };
  } catch (error) {
    console.error('Registration confirmation email failed', error);
    return { attempted: true, sent: false };
  }
}

async function activityByToken(db: ReturnType<typeof getPool>, token: string, forUpdate = false) {
  const result = await db.query(
    `select a.id, a.organization_id, a.title, a.type, a.venue, a.organizer, a.facilitator,
            a.start_date, a.end_date, a.reg_open, a.description,
            a.registration_capacity, a.waitlist_enabled, a.registration_opens_at,
            a.registration_closes_at, a.registration_approval_required,
            a.registration_confirmation_email, a.registration_confirmation_message,
            a.registration_custom_fields,
            o.name as organization_name, o.logo_url as organization_logo
     from activities a
     join organizations o on o.id = a.organization_id
     where a.reg_token = $1
     limit 1${forUpdate ? ' for update' : ''}`,
    [token]
  );
  return result.rows[0] || null;
}

async function registrationCounts(db: ReturnType<typeof getPool>, activityId: number, organizationId: string) {
  const result = await db.query(
    `select
       count(*) filter (where status = 'confirmed')::int as confirmed,
       count(*) filter (where status = 'pending')::int as pending,
       count(*) filter (where status = 'waitlisted')::int as waitlisted
     from registrations
     where organization_id = $1 and activity_id = $2`,
    [organizationId, activityId]
  );
  return result.rows[0] || { confirmed: 0, pending: 0, waitlisted: 0 };
}

export default async (request: Request, context: Context) => {
  if (request.method === 'POST' && isPreviewDeployment(request)) return previewReadOnlyResponse();
  const token = context.params.token;
  if (!token) return json({ error: 'Invalid registration link.' }, 400);
  const db = getPool();

  if (request.method === 'GET') {
    const activity = await activityByToken(db, token);
    if (!activity) return json({ error: 'Activity not found.' }, 404);
    const availability = registrationAvailability(activity);
    const counts = await registrationCounts(db, activity.id, activity.organization_id);
    return json({
      activity: {
        ...activity,
        registration_custom_fields: customFields(activity.registration_custom_fields),
        registration_open: availability.open,
        registration_closed_reason: availability.reason,
        registration_counts: counts,
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const body = await request.json().catch(() => ({})) as any;
  const action = String(body.action || 'register');
  const email = cleanEmail(body.email);
  if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const currentActivity = await activityByToken(db, token);
  if (!currentActivity) return json({ error: 'Activity not found.' }, 404);

  const participantResult = await db.query(
    `select id, name, email, pass_token
     from participants
     where organization_id = $1 and lower(btrim(email)) = $2
     limit 1`,
    [currentActivity.organization_id, email]
  );
  const participant = participantResult.rows[0] || null;

  const existingRegistration = participant
    ? await db.query(
        `select id, status, reference_code, registered_at
         from registrations
         where organization_id = $1 and activity_id = $2 and participant_id = $3
         limit 1`,
        [currentActivity.organization_id, currentActivity.id, participant.id]
      )
    : { rows: [] as any[], rowCount: 0 };

  if (action === 'lookup') {
    if (existingRegistration.rowCount) {
      const reg = existingRegistration.rows[0];
      return json({ state: 'already', status: reg.status, reference: reg.reference_code });
    }
    // Deliberately do not return stored phone, organisation, category, or full profile data.
    return json({ state: participant ? 'found' : 'new' });
  }

  if (action === 'resend') {
    if (!participant || !existingRegistration.rowCount) {
      // Avoid making this endpoint useful for account enumeration.
      return json({ ok: true });
    }
    const delivery = await sendConfirmation({
      request,
      activity: currentActivity,
      participant,
      registration: existingRegistration.rows[0],
    });
    return json({ ok: true, email_sent: delivery.sent });
  }

  if (existingRegistration.rowCount) {
    const reg = existingRegistration.rows[0];
    return json({ state: 'already', status: reg.status, reference: reg.reference_code }, 409);
  }

  const availability = registrationAvailability(currentActivity);
  if (!availability.open) return json({ error: availability.reason }, 409);

  const fields = customFields(currentActivity.registration_custom_fields);
  let answers: Record<string, unknown>;
  try { answers = validateAnswers(fields, body.custom_answers); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Check the registration form.' }, 400); }

  const client = await db.connect();
  try {
    await client.query('begin');
    const lockedActivity = await activityByToken(client as ReturnType<typeof getPool>, token, true);
    if (!lockedActivity) {
      await client.query('rollback');
      return json({ error: 'Activity not found.' }, 404);
    }
    const lockedAvailability = registrationAvailability(lockedActivity);
    if (!lockedAvailability.open) {
      await client.query('rollback');
      return json({ error: lockedAvailability.reason }, 409);
    }

    let participantRow = participant;
    if (!participantRow) {
      const name = String(body.name || '').trim().slice(0, 180);
      if (!name) {
        await client.query('rollback');
        return json({ error: 'Full name is required.' }, 400);
      }
      await assertCreationEntitlement(client as ReturnType<typeof getPool>, lockedActivity.organization_id, 'participants', { organization_id: lockedActivity.organization_id });
      const insertedParticipant = await client.query(
        `insert into participants (organization_id, name, email, phone, org, category)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (organization_id, lower(btrim(email))) where btrim(email) <> ''
         do nothing
         returning id, name, email, pass_token`,
        [
          lockedActivity.organization_id,
          name,
          email,
          String(body.phone || '').trim().slice(0, 80),
          String(body.org || '').trim().slice(0, 180),
          String(body.category || 'Community member').trim().slice(0, 80),
        ]
      );
      if (insertedParticipant.rowCount) participantRow = insertedParticipant.rows[0];
      else {
        const raced = await client.query(
          `select id, name, email, pass_token from participants
           where organization_id=$1 and lower(btrim(email))=$2 limit 1`,
          [lockedActivity.organization_id, email]
        );
        participantRow = raced.rows[0];
      }
    }

    if (!participantRow) throw new Error('Could not resolve participant identity.');

    const racedRegistration = await client.query(
      `select id, status, reference_code, registered_at
       from registrations where organization_id=$1 and activity_id=$2 and participant_id=$3 limit 1`,
      [lockedActivity.organization_id, lockedActivity.id, participantRow.id]
    );
    if (racedRegistration.rowCount) {
      await client.query('commit');
      const reg = racedRegistration.rows[0];
      return json({ state: 'already', status: reg.status, reference: reg.reference_code }, 409);
    }

    const counts = await registrationCounts(client as ReturnType<typeof getPool>, lockedActivity.id, lockedActivity.organization_id);
    const capacity = Number(lockedActivity.registration_capacity || 0);
    const capacityUsed = Number(counts.confirmed || 0) + Number(counts.pending || 0);
    let status = lockedActivity.registration_approval_required ? 'pending' : 'confirmed';
    if (capacity > 0 && capacityUsed >= capacity) {
      if (!lockedActivity.waitlist_enabled) {
        await client.query('rollback');
        return json({ error: 'This activity has reached capacity.' }, 409);
      }
      status = 'waitlisted';
    }

    const insertedRegistration = await client.query(
      `insert into registrations (organization_id, activity_id, participant_id, status, custom_answers, confirmed_at, reference_code)
       values ($1,$2,$3,$4,$5::jsonb,case when $4='confirmed' then now() else null end,
               'REG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)))
       returning id, status, reference_code, registered_at, confirmed_at`,
      [lockedActivity.organization_id, lockedActivity.id, participantRow.id, status, JSON.stringify(answers)]
    );
    await client.query('commit');

    const registration = insertedRegistration.rows[0];
    const delivery = await sendConfirmation({ request, activity: lockedActivity, participant: participantRow, registration });
    return json({
      state: 'registered',
      name: participantRow.name,
      status: registration.status,
      reference: registration.reference_code,
      pass_token: participantRow.pass_token,
      email_sent: delivery.sent,
    }, 201);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('Registration V2 failed', error);
    return json({ error: error instanceof Error ? error.message : 'Could not complete registration.' }, 400);
  } finally {
    client.release();
  }
};

export const config: Config = {
  path: '/api/public-registration/:token',
  method: ['GET', 'POST'],
};
