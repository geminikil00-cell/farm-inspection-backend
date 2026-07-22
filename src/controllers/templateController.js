import { query, getClient } from '../config/db.js';
import { notifyAdmins } from './notificationController.js';

export const getTemplates = async (req, res) => {
  try {
    const { status, category } = req.query;
    let sql = `
      SELECT t.*, u.username as created_by_name
      FROM audit_templates t
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.org_id = $1
    `;
    const params = [req.orgId];
    let idx = 2;

    if (status) {
      sql += ` AND t.status = $${idx++}`;
      params.push(status);
    }
    if (category && category !== 'all') {
      sql += ` AND t.category = $${idx++}`;
      params.push(category);
    }

    sql += ' ORDER BY t.updated_at DESC';

    const result = await query(sql, params);
    res.json({ templates: result.rows });
  } catch (err) {
    console.error('getTemplates error:', err.message);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

export const getTemplate = async (req, res) => {
  try {
    const result = await query(
      `SELECT t.*, u.username as created_by_name
       FROM audit_templates t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.id = $1 AND t.org_id = $2`,
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ template: result.rows[0] });
  } catch (err) {
    console.error('getTemplate error:', err.message);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const { name, category, description, sections, scoring_config } = req.body;

    const result = await query(
      `INSERT INTO audit_templates
         (org_id, name, category, description, sections, scoring_config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.orgId,
        name,
        category || 'general',
        description || '',
        JSON.stringify(sections || []),
        JSON.stringify(scoring_config || { method: 'percentage', pass_threshold: 70 }),
        req.userId,
      ]
    );

    res.status(201).json({ template: result.rows[0] });
  } catch (err) {
    console.error('createTemplate error:', err.message);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const check = await query(
      'SELECT id, status FROM audit_templates WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (check.rows[0].status === 'published') {
      return res.status(400).json({ error: 'Cannot edit a published template. Create a new version instead.' });
    }

    const { name, category, description, sections, scoring_config } = req.body;

    const result = await query(
      `UPDATE audit_templates SET
         name = COALESCE($3, name),
         category = COALESCE($4, category),
         description = COALESCE($5, description),
         sections = COALESCE($6::jsonb, sections),
         scoring_config = COALESCE($7::jsonb, scoring_config),
         updated_at = now()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [
        req.params.id,
        req.orgId,
        name,
        category,
        description,
        sections ? JSON.stringify(sections) : null,
        scoring_config ? JSON.stringify(scoring_config) : null,
      ]
    );

    res.json({ template: result.rows[0] });
  } catch (err) {
    console.error('updateTemplate error:', err.message);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

export const publishTemplate = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const check = await client.query(
      'SELECT * FROM audit_templates WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Template not found' });
    }

    const current = check.rows[0];

    if (current.status === 'published') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Template is already published' });
    }

    await client.query(
      `UPDATE audit_templates SET status = 'published', updated_at = now()
       WHERE id = $1`,
      [current.id]
    );

    const nextVersion = (current.version || 1) + 1;
    const draftResult = await client.query(
      `INSERT INTO audit_templates
         (org_id, name, version, category, description, sections, scoring_config,
          status, published_from, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'draft', $8, $9)
       RETURNING *`,
      [
        req.orgId,
        current.name,
        nextVersion,
        current.category,
        current.description,
        JSON.stringify(current.sections),
        JSON.stringify(current.scoring_config),
        current.id,
        req.userId,
      ]
    );

    await client.query('COMMIT');

    await notifyAdmins(null, {
      title: `Template published: ${current.name}`,
      details: `Version ${current.version} · ${current.category} · ${(current.sections || []).length} sections`,
      type: 'template_published',
      unitId: req.orgId,
      relatedId: current.id,
    });

    res.json({
      template: current,
      draft: draftResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('publishTemplate error:', err.message);
    res.status(500).json({ error: 'Failed to publish template' });
  } finally {
    client.release();
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM audit_templates WHERE id = $1 AND org_id = $2 RETURNING id',
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTemplate error:', err.message);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

export const archiveTemplate = async (req, res) => {
  try {
    const result = await query(
      `UPDATE audit_templates SET status = 'archived', updated_at = now()
       WHERE id = $1 AND org_id = $2 AND status = 'published'
       RETURNING *`,
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Published template not found' });
    }
    res.json({ template: result.rows[0] });
  } catch (err) {
    console.error('archiveTemplate error:', err.message);
    res.status(500).json({ error: 'Failed to archive template' });
  }
};
