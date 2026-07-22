import { query, getClient } from '../config/db.js';
import { autoCreateNCsFromAudit } from './ncController.js';
import { notifyAdmins } from './notificationController.js';

const STATUS_SCORE_MAP = { 'ممتاز': 100, 'جيد جداً': 80, 'جيد': 60, 'مقبول': 40, 'سيء': 0 };

function scoreQuestion(q, response) {
  const val = response?.value;
  if (val === undefined || val === null || val === '') return 0;

  switch (q.type) {
    case 'rating': {
      const options = q.options || ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'سيء'];
      const idx = options.indexOf(val);
      if (idx >= 0) {
        const step = 100 / (options.length - 1);
        return Math.round(100 - idx * step);
      }
      return STATUS_SCORE_MAP[val] || 0;
    }
    case 'yes_no':
      return val === 'yes' ? 100 : val === 'na' ? null : 0;
    case 'checkbox': {
      if (!q.options || !q.options.length) return 0;
      const selected = Array.isArray(val) ? val : [val].filter(Boolean);
      if (!selected.length) return 0;
      return Math.round((selected.length / q.options.length) * 100);
    }
    case 'text':
    case 'photo':
      return null;
    default:
      return 0;
  }
}

function calculateOverallScore(responses) {
  let totalEarned = 0;
  let totalMax = 0;

  for (const section of responses) {
    for (const q of section.questions) {
      const resp = section.responses?.[q.id];
      const maxScore = q.type === 'yes_no' || q.type === 'rating' || q.type === 'checkbox' ? 100 : 0;
      const earned = scoreQuestion(q, resp);

      if (earned !== null) {
        totalEarned += earned;
        totalMax += maxScore;
      }
    }
  }

  if (totalMax === 0) return 0;
  return Math.round((totalEarned / totalMax) * 100);
}

export const getAudits = async (req, res) => {
  try {
    const { status, template_id } = req.query;
    let sql = `
      SELECT id, template_id, template_name, template_version, template_category,
             overall_score, passed, status, nc_flags, site_name, inspector,
             audit_date, started_at, completed_at, created_at
      FROM audit_records
      WHERE org_id = $1
    `;
    const params = [req.orgId];
    let idx = 2;

    if (status) {
      sql += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (template_id) {
      sql += ` AND template_id = $${idx++}`;
      params.push(template_id);
    }

    sql += ' ORDER BY created_at DESC LIMIT 200';

    const result = await query(sql, params);
    res.json({ audits: result.rows });
  } catch (err) {
    console.error('getAudits error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
};

export const getAudit = async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, u.username as auditor_name
       FROM audit_records a
       LEFT JOIN users u ON u.id = a.auditor_id
       WHERE a.id = $1 AND a.org_id = $2`,
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit not found' });
    }
    res.json({ audit: result.rows[0] });
  } catch (err) {
    console.error('getAudit error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit' });
  }
};

export const createAudit = async (req, res) => {
  try {
    const { template_id, site_name, inspector, audit_date } = req.body;

    const templateRes = await query(
      'SELECT * FROM audit_templates WHERE id = $1 AND org_id = $2 AND status = $3',
      [template_id, req.orgId, 'published']
    );
    if (templateRes.rows.length === 0) {
      return res.status(400).json({ error: 'Template not found or not published' });
    }
    const template = templateRes.rows[0];
    const sections = template.sections || [];
    const scoringConfig = template.scoring_config || {};

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

    const result = await query(
      `INSERT INTO audit_records
         (org_id, template_id, auditor_id, template_name, template_version,
          template_category, scoring_method, pass_threshold, responses,
          site_name, inspector, audit_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'in_progress')
       RETURNING *`,
      [
        req.orgId,
        template_id,
        req.userId,
        template.name,
        template.version,
        template.category,
        scoringConfig.method || 'percentage',
        scoringConfig.pass_threshold || 70,
        JSON.stringify(responses),
        site_name || '',
        inspector || req.username || '',
        audit_date || new Date().toISOString().split('T')[0],
      ]
    );

    res.status(201).json({ audit: result.rows[0] });
  } catch (err) {
    console.error('createAudit error:', err.message);
    res.status(500).json({ error: 'Failed to create audit' });
  }
};

export const updateAuditResponses = async (req, res) => {
  try {
    const { responses, site_name, inspector, audit_date } = req.body;

    const auditRes = await query(
      'SELECT * FROM audit_records WHERE id = $1 AND org_id = $2 AND status = $3',
      [req.params.id, req.orgId, 'in_progress']
    );
    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'Audit not found or already submitted' });
    }

    await query(
      `UPDATE audit_records SET
         responses = $3::jsonb, site_name = COALESCE($4, site_name),
         inspector = COALESCE($5, inspector), audit_date = COALESCE($6, audit_date),
         updated_at = now()
       WHERE id = $1 AND org_id = $2`,
      [
        req.params.id, req.orgId,
        JSON.stringify(responses),
        site_name, inspector, audit_date,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('updateAuditResponses error:', err.message);
    res.status(500).json({ error: 'Failed to save audit progress' });
  }
};

export const submitAudit = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { responses } = req.body;

    const auditRes = await client.query(
      'SELECT * FROM audit_records WHERE id = $1 AND org_id = $2 AND status = $3',
      [req.params.id, req.orgId, 'in_progress']
    );
    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'Audit not found or already submitted' });
    }

    const audit = auditRes.rows[0];
    const sections = responses || audit.responses;

    const overallScore = calculateOverallScore(sections);
    const passThreshold = audit.pass_threshold;
    const passed = overallScore >= passThreshold;

    let ncFlags = 0;
    if (Array.isArray(sections)) {
      for (const section of sections) {
        if (section.responses) {
          for (const [qid, resp] of Object.entries(section.responses)) {
            if (resp?.nc_flagged) ncFlags++;
          }
        }
      }
    }

    await autoCreateNCsFromAudit(client, { ...audit, responses: sections }, req.userId, req.username);

    const result = await client.query(
      `UPDATE audit_records SET
         status = 'submitted', responses = $3::jsonb,
         overall_score = $4, passed = $5, nc_flags = $6,
         completed_at = now(), updated_at = now()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [req.params.id, req.orgId, JSON.stringify(sections), overallScore, passed, ncFlags]
    );

    await client.query('COMMIT');

    await notifyAdmins(null, {
      title: `Audit submitted: ${audit.template_name}`,
      details: `Score: ${overallScore}% · ${ncFlags} NC flagged · ${audit.site_name || ''}`,
      type: 'audit_submitted',
      unitId: req.orgId,
      relatedId: req.params.id,
    });

    res.json({ audit: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('submitAudit error:', err.message);
    res.status(500).json({ error: 'Failed to submit audit' });
  } finally {
    client.release();
  }
};

export const deleteAudit = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM audit_records WHERE id = $1 AND org_id = $2 RETURNING id',
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete audit' });
  }
};
