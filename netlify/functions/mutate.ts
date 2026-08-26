import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getPool } from './_shared/db';
import { assertCreationEntitlement, PlanLimitError } from './_shared/billing';
import { maybeSendAwardedCertificate } from './_shared/certificate-delivery';
import { requireTenant } from './_shared/tenant';

export default async (request: Request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const tenant = await requireTenant(request);
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, payload = {} } = await request.json().catch(() => ({}));
  const db = getPool();
  const orgId = tenant.organization_id;
  const userId = tenant.user.id;
  const isAdmin = ['owner', 'admin'].includes(tenant.role);
  const canMutate = ['owner', 'admin', 'programme_manager', 'facilitator', 'me_officer'].includes(tenant.role);

  if (!canMutate) {
    return Response.json({ error: 'Read-only role' }, { status: 403 });
  }

  try {
    switch (action) {
      case 'review_approval': {
        if (!isAdmin) return Response.json({ error: 'Admin permission required' }, { status: 403 });
        const approvalId = payload.approvalId;
        const decision = payload.decision;
        if (!approvalId || !['approved', 'rejected'].includes(decision)) {
          return Response.json({ error: 'Invalid approval decision' }, { status: 400 });
        }

        const client = await db.connect();
        try {
          await client.query('begin');
          const locked = await client.query(
            `select id, organization_id, requested_by, action_type, payload, status
             from pending_approvals
             where id = $1 and organization_id = $2
             for update`,
            [approvalId, orgId]
          );
          if (!locked.rowCount) {
            await client.query('rollback');
            return Response.json({ error: 'Approval request not found' }, { status: 404 });
          }

          const approval = locked.rows[0];
          if (approval.status !== 'pending') {
            await client.query('rollback');
            return Response.json({ error: `Approval has already been ${approval.status}` }, { status: 409 });
          }

          let executed: unknown = null;
          let autoCertificateId: number | null = null;
          if (decision === 'approved') {
            const p = approval.payload || {};

            if (approval.action_type === 'add_participant') {
              if (!p.name || !p.email) throw new Error('Approval payload is missing participant details');
              await assertCreationEntitlement(client as ReturnType<typeof getPool>, orgId, 'participants', p);
              const result = await client.query(
                `insert into participants (organization_id, name, email, phone, org, category)
                 values ($1,$2,$3,$4,$5,$6) returning *`,
                [orgId, p.name, String(p.email).toLowerCase(), p.phone || '', p.org || '', p.category || 'Community member']
              );
              const participant = result.rows[0];
              const activityIds = Array.isArray(p.activity_ids)
                ? [...new Set(p.activity_ids.map((id: unknown) => Number(id)).filter(Number.isSafeInteger))]
                : [];
              if (activityIds.length) {
                const validActivities = await client.query(
                  `select id from activities where organization_id = $1 and id = any($2::bigint[])`,
                  [orgId, activityIds]
                );
                if (validActivities.rowCount !== activityIds.length) throw new Error('Approval references an invalid activity');
                for (const activityId of activityIds) {
                  await client.query(
                    `insert into registrations (organization_id, activity_id, participant_id)
                     values ($1,$2,$3)
                     on conflict (activity_id, participant_id) do nothing`,
                    [orgId, activityId, participant.id]
                  );
                }
              }
              executed = { ...participant, activity_ids: activityIds };
            } else if (approval.action_type === 'issue_certificate') {
              const context = await client.query(
                `select a.id as activity_id, p.id as participant_id
                 from activities a, participants p
                 where a.id = $1 and a.organization_id = $3
                   and p.id = $2 and p.organization_id = $3`,
                [p.activity_id, p.participant_id, orgId]
              );
              if (!context.rowCount) throw new Error('Certificate approval references an invalid activity or participant');
              await assertCreationEntitlement(client as ReturnType<typeof getPool>, orgId, 'certificates', p);

              const placeholder = `PENDING-${randomUUID()}`;
              const inserted = await client.query(
                `insert into certificates (organization_id, cert_no, activity_id, participant_id, certificate_type, issued_by)
                 values ($1,$2,$3,$4,$5,$6) returning *`,
                [orgId, placeholder, p.activity_id, p.participant_id, p.certificate_type || 'completion', userId]
              );
              const cert = inserted.rows[0];
              const certNo = `LEX-${new Date().getFullYear()}-${String(cert.id).padStart(4, '0')}`;
              const updated = await client.query(
                'update certificates set cert_no = $2 where id = $1 returning *',
                [cert.id, certNo]
              );
              executed = updated.rows[0];
              autoCertificateId = Number(updated.rows[0].id);
            } else if (approval.action_type === 'delete_participant') {
              const participantId = p.id || p.participant_id;
              if (!participantId) throw new Error('Approval payload is missing participant id');
              const deleted = await client.query(
                'delete from participants where id = $1 and organization_id = $2 returning id, name, email',
                [participantId, orgId]
              );
              if (!deleted.rowCount) throw new Error('Participant not found');
              executed = deleted.rows[0];
            } else {
              throw new Error(`Unsupported approval action: ${approval.action_type}`);
            }
          }

          const reviewed = await client.query(
            `update pending_approvals
             set status = $1, reviewed_by = $2, reviewed_at = now()
             where id = $3 and organization_id = $4
             returning *`,
            [decision, userId, approvalId, orgId]
          );

          await client.query(
            `insert into audit_log (organization_id, user_id, action, entity_type, entity_id, metadata)
             values ($1,$2,$3,'pending_approval',$4,$5::jsonb)`,
            [orgId, userId, `approval.${decision}`, String(approvalId), JSON.stringify({ action_type: approval.action_type, requested_by: approval.requested_by })]
          );

          await client.query('commit');

          let emailDelivery: unknown = null;
          if (autoCertificateId) {
            try {
              emailDelivery = await maybeSendAwardedCertificate({
                db,
                request,
                tenant,
                certificateId: autoCertificateId,
                createdBy: userId,
              });
            } catch (error) {
              console.error('Automatic certificate delivery failed after approval', { autoCertificateId, error });
              emailDelivery = { attempted: true, sent: false, error: error instanceof Error ? error.message : 'Delivery failed' };
            }
          }

          return Response.json({ approval: reviewed.rows[0], executed, email_delivery: emailDelivery });
        } catch (error) {
          await client.query('rollback').catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      }
      case 'add_activity': {
        const a = payload.activity || {};
        await assertCreationEntitlement(db, orgId, 'activities', a);
        const result = await db.query(
          `insert into activities (organization_id, title, type, status, venue, organizer, facilitator, start_date, end_date, sessions, reg_open, description, created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           returning *`,
          [orgId, a.title, a.type || 'Training', a.status || 'Upcoming', a.venue || 'TBD', a.organizer || '', a.facilitator || '', a.start_date, a.end_date, a.sessions || 1, a.reg_open ?? true, a.description || '', userId]
        );
        return Response.json(result.rows[0]);
      }
      case 'update_activity': {
        const { id, updates = {} } = payload;
        const allowed = ['title','type','status','venue','organizer','facilitator','start_date','end_date','sessions','reg_open','description'];
        const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
        if (!entries.length) return Response.json({ error: 'No valid updates' }, { status: 400 });
        if (['Upcoming', 'Ongoing'].includes(updates.status)) {
          const current = await db.query('select status from activities where id = $1 and organization_id = $2', [id, orgId]);
          if (!current.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
          if (current.rows[0].status === 'Completed') await assertCreationEntitlement(db, orgId, 'activities', updates);
        }
        const sets = entries.map(([key], i) => `${key} = $${i + 3}`).join(', ');
        const result = await db.query(
          `update activities set ${sets}, updated_at = now() where id = $1 and organization_id = $2 returning *`,
          [id, orgId, ...entries.map(([, value]) => value)]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Not found' }, { status: 404 });
      }
      case 'delete_activity': {
        if (!isAdmin) return Response.json({ error: 'Admin approval required' }, { status: 403 });
        await db.query('delete from activities where id = $1 and organization_id = $2', [payload.id, orgId]);
        return Response.json({ ok: true });
      }
      case 'add_participant': {
        const p = payload.participant || {};
        if (!isAdmin) {
          const requestedActivityIds = Array.isArray(payload.activityIds)
            ? [...new Set(payload.activityIds.map((id: unknown) => Number(id)).filter(Number.isSafeInteger))]
            : [];
          if (requestedActivityIds.length) {
            const validActivities = await db.query(
              `select id from activities where organization_id = $1 and id = any($2::bigint[])`,
              [orgId, requestedActivityIds]
            );
            if (validActivities.rowCount !== requestedActivityIds.length) {
              return Response.json({ error: 'Invalid activity selection' }, { status: 400 });
            }
          }
          await db.query(
            `insert into pending_approvals (organization_id, requested_by, action_type, payload)
             values ($1,$2,'add_participant',$3::jsonb)`,
            [orgId, userId, JSON.stringify({ ...p, activity_ids: requestedActivityIds })]
          );
          return Response.json({ pending: true });
        }
        await assertCreationEntitlement(db, orgId, 'participants', p);
        const result = await db.query(
          `insert into participants (organization_id, name, email, phone, org, category)
           values ($1,$2,$3,$4,$5,$6) returning *`,
          [orgId, p.name, p.email, p.phone || '', p.org || '', p.category || 'Community member']
        );
        return Response.json(result.rows[0]);
      }
      case 'update_participant': {
        const { id, updates = {} } = payload;
        const allowed = ['name','email','phone','org','category'];
        const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
        if (!entries.length) return Response.json({ error: 'No valid updates' }, { status: 400 });
        const sets = entries.map(([key], i) => `${key} = $${i + 3}`).join(', ');
        const result = await db.query(
          `update participants set ${sets}, updated_at = now() where id = $1 and organization_id = $2 returning *`,
          [id, orgId, ...entries.map(([, value]) => value)]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Not found' }, { status: 404 });
      }
      case 'delete_participant': {
        const participant = await db.query(
          'select id, name, email from participants where id = $1 and organization_id = $2',
          [payload.id, orgId]
        );
        if (!participant.rowCount) return Response.json({ error: 'Participant not found' }, { status: 404 });
        if (!isAdmin) {
          await db.query(
            `insert into pending_approvals (organization_id, requested_by, action_type, payload)
             values ($1,$2,'delete_participant',$3::jsonb)`,
            [orgId, userId, JSON.stringify(participant.rows[0])]
          );
          return Response.json({ pending: true });
        }
        await db.query('delete from participants where id = $1 and organization_id = $2', [payload.id, orgId]);
        return Response.json({ ok: true });
      }
      case 'add_registration': {
        const result = await db.query(
          `insert into registrations (organization_id, activity_id, participant_id)
           select $1, a.id, p.id from activities a join participants p on p.id = $3
           where a.id = $2 and a.organization_id = $1 and p.organization_id = $1
           on conflict (activity_id, participant_id) do update set registered_at = registrations.registered_at
           returning *`,
          [orgId, payload.activityId, payload.participantId]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Invalid activity or participant' }, { status: 400 });
      }
      case 'upsert_attendance': {
        const result = await db.query(
          `insert into attendance (organization_id, activity_id, participant_id, session_label, status)
           select $1, a.id, p.id, $4, $5 from activities a join participants p on p.id = $3
           where a.id = $2 and a.organization_id = $1 and p.organization_id = $1
           on conflict (activity_id, participant_id,session_label)
           do update set status = excluded.status, recorded_at = now()
           returning *`,
          [orgId, payload.activityId, payload.participantId, payload.sessionLabel, payload.status]
        );
        return result.rowCount ? Response.json(result.rows[0]) : Response.json({ error: 'Invalid activity or participant' }, { status: 400 });
      }
      case 'issue_certificate': {
        if (!isAdmin) {
          const context = await db.query(
            `select a.title as activity_title, p.name as participant_name
             from activities a, participants p
             where a.id = $1 and a.organization_id = $3 and p.id = $2 and p.organization_id = $3`,
            [payload.activityId, payload.participantId, orgId]
          );
          if (!context.rowCount) return Response.json({ error: 'Invalid activity or participant' }, { status: 400 });
          const pendingPayload = {
            activity_id: payload.activityId,
            participant_id: payload.participantId,
            certificate_type: payload.certificateType || 'completion',
            activity_title: context.rows[0].activity_title,
            participant_name: context.rows[0].participant_name,
          };
          await db.query(
            `insert into pending_approvals (organization_id, requested_by, action_type, payload)
             values ($1,$2,'issue_certificate',$3::jsonb)`,
            [orgId, userId, JSON.stringify(pendingPayload)]
          );
          return Response.json({ pending: true });
        }
        await assertCreationEntitlement(db, orgId, 'certificates', payload);
        const placeholder = `PENDING-${randomUUID()}`;
        const inserted = await db.query(
          `insert into certificates (organization_id, cert_no, activity_id, participant_id, certificate_type, issued_by)
           select $1, $4, a.id, p.id, $5, $6 from activities a join participants p on p.id = $3
           where a.id = $2 and a.organization_id = $1 and p.organization_id = $1
           returning *`,
          [orgId, payload.activityId, payload.participantId, placeholder, payload.certificateType || 'completion', userId]
        );
        if (!inserted.rowCount) return Response.json({ error: 'Invalid activity or participant' }, { status: 400 });
        const cert = inserted.rows[0];
        const certNo = `LEX-${new Date().getFullYear()}-${String(cert.id).padStart(4, '0')}`;
        const updated = await db.query('update certificates set cert_no = $2 where id = $1 returning *', [cert.id, certNo]);
        const certificate = updated.rows[0];
        let emailDelivery: unknown = null;
        try {
          emailDelivery = await maybeSendAwardedCertificate({
            db,
            request,
            tenant,
            certificateId: Number(certificate.id),
            createdBy: userId,
          });
        } catch (error) {
          console.error('Automatic certificate delivery failed after direct award', { certificateId: certificate.id, error });
          emailDelivery = { attempted: true, sent: false, error: error instanceof Error ? error.message : 'Delivery failed' };
        }
        return Response.json({ ...certificate, email_delivery: emailDelivery });
      }
      default:
        return Response.json({ error: 'Unsupported action' }, { status: 400 });
    }
  } catch (error) {
    console.error('LexAMS mutation failed', { action, error });
    if (error instanceof PlanLimitError) return Response.json(error.toResponse(), { status: error.code === 'PRO_REQUIRED' ? 403 : 409 });
    return Response.json({ error: error instanceof Error ? error.message : 'Mutation failed' }, { status: 500 });
  }
};

export const config: Config = { path: '/api/mutate' };
