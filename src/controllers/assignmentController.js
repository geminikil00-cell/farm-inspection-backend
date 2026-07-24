import { query, getClient } from '../config/db.js';

export const getAssignments = async (req, res) => {
  try {
    const { status, auditor_id } = req.query;
    let sql = `
      SELECT a.*, t.name as template_name, t.version as template_version, t.category as template_category,
             u.username as auditor_name, u.full_name as auditor_fullname,
             au.username as assigned_by_name
      FROM audit_assignments a
      JOIN audit_templates t ON t.id = a.template_id
      JOIN users u ON u.id = a.auditor_id
      JOIN users au ON au.id = a.assigned_by
      WHERE a.org_id = $1
    `;
    const params = [req.orgId];
    let idx = 2;

    if (status && status !== 'all') {
      sql += ` AND a.status = $${idx++}`;
      params.push(status);
    }
    if (auditor_id) {
      sql += ` AND a.auditor_id = $${idx++}`;
      params.push(auditor_id);
    }

    sql += ' ORDER BY a.assigned_at DESC LIMIT 500';

    const result = await query(sql, params);
    res.json({ assignments: result.rows });
  } catch (err) {
    console.error('getAssignments error:', err.message);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

export const createAssignments = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { template_ids, auditor_id, due_date } = req.body;
    if (!template_ids || !template_ids.length || !auditor_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'template_ids and auditor_id required' });
    }

    const created = [];
    for (const tid of template_ids) {
      const r = await client.query(
        `INSERT INTO audit_assignments (org_id, template_id, auditor_id, assigned_by, due_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.orgId, tid, auditor_id, req.userId, due_date || null]
      );
      created.push(r.rows[0]);
    }

    await client.query('COMMIT');

    const full = await query(
      `SELECT a.*, t.name as template_name, u.username as auditor_name
       FROM audit_assignments a
       JOIN audit_templates t ON t.id = a.template_id
       JOIN users u ON u.id = a.auditor_id
       WHERE a.id = ANY($1)`,
      [created.map(c => c.id)]
    );

    res.status(201).json({ assignments: full.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createAssignments error:', err.message);
    res.status(500).json({ error: 'Failed to create assignments' });
  } finally {
    client.release();
  }
};

export const startAssignment = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const assignment = await client.query(
      'SELECT * FROM audit_assignments WHERE id = $1 AND org_id = $2 AND auditor_id = $3 AND status = $4',
      [req.params.id, req.orgId, req.userId, 'pending']
    );
    if (assignment.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assignment not found or already started' });
    }

    const tpl = await client.query(
      'SELECT * FROM audit_templates WHERE id = $1',
      [assignment.rows[0].template_id]
    );
    if (tpl.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = tpl.rows[0];
    const sections = template.sections || [];
    const responses = sections.map((section) => ({
      section_id: section.id,
      section_title: section.title,
      questions: (section.questions || []).map((q) => ({
        question_id: q.id,
        type: q.type,
        label: q.label,
        required: q.required,
        options: q.options,
      })),
      responses: {},
    }));

    const audit = await client.query(
      `INSERT INTO audit_records
         (org_id, template_id, auditor_id, template_name, template_version,
          template_category, scoring_method, pass_threshold, responses, site_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'in_progress')
       RETURNING *`,
      [req.orgId, template.id, req.userId, template.name, template.version,
       template.category, template.scoring_config?.method || 'percentage',
       template.scoring_config?.pass_threshold || 70, JSON.stringify(responses), '']
    );

    await client.query(
      'UPDATE audit_assignments SET status = $1, audit_record_id = $2 WHERE id = $3',
      ['in_progress', audit.rows[0].id, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ audit: audit.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('startAssignment error:', err.message);
    res.status(500).json({ error: 'Failed to start audit' });
  } finally {
    client.release();
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const r = await query('DELETE FROM audit_assignments WHERE id = $1 AND org_id = $2 RETURNING id', [req.params.id, req.orgId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
};
