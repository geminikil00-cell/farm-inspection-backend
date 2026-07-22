import { query, getClient } from '../config/db.js';

const VALID_TRANSITIONS = {
  open: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['action_taken'],
  action_taken: ['under_review'],
  under_review: ['closed', 'reopened'],
  reopened: ['in_progress'],
  closed: [],
};

function buildTimeline(prev, action, userId, username, note) {
  const entries = Array.isArray(prev) ? prev : [];
  entries.push({
    action,
    userId,
    username,
    note: note || '',
    timestamp: new Date().toISOString(),
  });
  return entries;
}

export const autoCreateNCsFromAudit = async (client, audit, userId, username) => {
  const responses = audit.responses || [];
  let created = 0;

  for (const section of responses) {
    if (!section.responses) continue;
    for (const [qid, resp] of Object.entries(section.responses)) {
      if (!resp?.nc_flagged) continue;

      const question = (section.questions || []).find(q => (q.question_id || q.id) === qid);
      const timeline = buildTimeline([], 'open', userId, username, 'NC automatically raised from audit submission');

      await client.query(
        `INSERT INTO nc_records
           (org_id, audit_id, severity, category, section_ref, question_ref,
            description, evidence_photos, assigned_to, raised_by, due_date, timeline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 NOW() + INTERVAL '14 days', $11::jsonb)`,
        [
          audit.org_id, audit.id,
          resp.nc_severity || 'Minor',
          audit.template_category || 'general',
          section.section_id || section.id,
          qid,
          resp.nc_description || question?.label || 'Non-conformance flagged',
          resp.evidence_photos || [],
          null,
          userId,
          JSON.stringify(timeline),
        ]
      );
      created++;
    }
  }
  return created;
};

export const getNCs = async (req, res) => {
  try {
    const { status, severity, assigned_to, audit_id } = req.query;

    let sql = `
      SELECT n.*,
             u.username as assigned_name, r.username as raised_name
      FROM nc_records n
      LEFT JOIN users u ON u.id = n.assigned_to
      LEFT JOIN users r ON r.id = n.raised_by
      WHERE n.org_id = $1
    `;
    const params = [req.orgId];
    let idx = 2;

    if (status && status !== 'all') {
      sql += ` AND n.status = $${idx++}`;
      params.push(status);
    }
    if (severity && severity !== 'all') {
      sql += ` AND n.severity = $${idx++}`;
      params.push(severity);
    }
    if (assigned_to === 'me') {
      sql += ` AND n.assigned_to = $${idx++}`;
      params.push(req.userId);
    } else if (assigned_to) {
      sql += ` AND n.assigned_to = $${idx++}`;
      params.push(assigned_to);
    }
    if (audit_id) {
      sql += ` AND n.audit_id = $${idx++}`;
      params.push(audit_id);
    }

    sql += ' ORDER BY n.created_at DESC LIMIT 500';

    const result = await query(sql, params);
    res.json({ ncs: result.rows });
  } catch (err) {
    console.error('getNCs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch NCs' });
  }
};

export const getNC = async (req, res) => {
  try {
    const result = await query(
      `SELECT n.*, u.username as assigned_name, r.username as raised_name
       FROM nc_records n
       LEFT JOIN users u ON u.id = n.assigned_to
       LEFT JOIN users r ON r.id = n.raised_by
       WHERE n.id = $1 AND n.org_id = $2`,
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NC not found' });
    }
    res.json({ nc: result.rows[0] });
  } catch (err) {
    console.error('getNC error:', err.message);
    res.status(500).json({ error: 'Failed to fetch NC' });
  }
};

export const createNC = async (req, res) => {
  try {
    const { audit_id, severity, category, description, evidence_photos, assigned_to, section_ref, question_ref } = req.body;

    const timeline = buildTimeline([], 'open', req.userId, req.username, 'NC manually raised');

    const result = await query(
      `INSERT INTO nc_records
         (org_id, audit_id, severity, category, section_ref, question_ref,
          description, evidence_photos, assigned_to, raised_by,
          due_date, timeline, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               NOW() + INTERVAL '14 days', $11::jsonb, 'open')
       RETURNING *`,
      [
        req.orgId, audit_id, severity, category, section_ref, question_ref,
        description, evidence_photos || [], assigned_to, req.userId,
        JSON.stringify(timeline),
      ]
    );

    res.status(201).json({ nc: result.rows[0] });
  } catch (err) {
    console.error('createNC error:', err.message);
    res.status(500).json({ error: 'Failed to create NC' });
  }
};

export const updateNCStatus = async (req, res) => {
  try {
    const { status: newStatus, note } = req.body;

    const current = await query(
      'SELECT * FROM nc_records WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'NC not found' });
    }
    const nc = current.rows[0];

    if (nc.status === 'closed') {
      return res.status(400).json({ error: 'Cannot change a closed NC' });
    }

    const allowed = VALID_TRANSITIONS[nc.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid transition from ${nc.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`,
      });
    }

    const timeline = buildTimeline(nc.timeline, newStatus, req.userId, req.username, note);

    const fields = {
      status: newStatus,
      timeline: JSON.stringify(timeline),
      updated_at: new Date(),
    };

    if (newStatus === 'closed') {
      fields.closed_at = new Date();
    }

    const sets = Object.keys(fields).map((k, i) => `"${k}" = $${i + 3}`).join(', ');
    const result = await query(
      `UPDATE nc_records SET ${sets} WHERE id = $1 AND org_id = $2 RETURNING *`,
      [req.params.id, req.orgId, ...Object.values(fields)]
    );

    res.json({ nc: result.rows[0] });
  } catch (err) {
    console.error('updateNCStatus error:', err.message);
    res.status(500).json({ error: 'Failed to update NC status' });
  }
};

export const updateNC = async (req, res) => {
  try {
    const check = await query(
      'SELECT * FROM nc_records WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'NC not found' });
    }

    const { description, root_cause, corrective_action, verification_notes, severity, assigned_to, due_date } = req.body;

    const result = await query(
      `UPDATE nc_records SET
         description = COALESCE($3, description),
         root_cause = COALESCE($4, root_cause),
         corrective_action = COALESCE($5, corrective_action),
         verification_notes = COALESCE($6, verification_notes),
         severity = COALESCE($7, severity),
         assigned_to = COALESCE($8::uuid, assigned_to),
         due_date = COALESCE($9::timestamptz, due_date),
         updated_at = now()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [req.params.id, req.orgId, description, root_cause, corrective_action, verification_notes,
       severity, assigned_to, due_date]
    );

    res.json({ nc: result.rows[0] });
  } catch (err) {
    console.error('updateNC error:', err.message);
    res.status(500).json({ error: 'Failed to update NC' });
  }
};

export const addNCTimelineEntry = async (req, res) => {
  try {
    const { action, note } = req.body;

    const current = await query(
      'SELECT * FROM nc_records WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'NC not found' });
    }

    const timeline = buildTimeline(current.rows[0].timeline, action, req.userId, req.username, note);

    const result = await query(
      'UPDATE nc_records SET timeline = $3::jsonb, updated_at = now() WHERE id = $1 AND org_id = $2 RETURNING *',
      [req.params.id, req.orgId, JSON.stringify(timeline)]
    );

    res.json({ nc: result.rows[0] });
  } catch (err) {
    console.error('addNCTimelineEntry error:', err.message);
    res.status(500).json({ error: 'Failed to add timeline entry' });
  }
};

export const getNCStats = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE status = 'open')::int as open,
         COUNT(*) FILTER (WHERE status IN ('in_progress', 'assigned'))::int as in_progress,
         COUNT(*) FILTER (WHERE status = 'action_taken' OR status = 'under_review')::int as under_review,
         COUNT(*) FILTER (WHERE status = 'closed')::int as closed,
         COUNT(*) FILTER (WHERE status = 'reopened')::int as reopened,
         COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'closed')::int as overdue,
         COUNT(*) FILTER (WHERE severity = 'Critical')::int as critical,
         COUNT(*) FILTER (WHERE severity = 'Major')::int as major
       FROM nc_records WHERE org_id = $1`,
      [req.orgId]
    );
    res.json({ stats: result.rows[0] });
  } catch (err) {
    console.error('getNCStats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch NC stats' });
  }
};
