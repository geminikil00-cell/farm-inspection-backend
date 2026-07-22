import { query, getClient } from '../config/db.js';
import { ROLES } from '../config/roles.js';

export const getUnits = async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, COUNT(u.id)::int as user_count,
         COUNT(a.id)::int as audit_count,
         COUNT(n.id) FILTER (WHERE n.status != 'closed')::int as open_nc_count
       FROM organizations o
       LEFT JOIN users u ON u.org_id = o.id AND u.status = 'active'
       LEFT JOIN audit_records a ON a.org_id = o.id
       LEFT JOIN nc_records n ON n.org_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    res.json({ units: result.rows });
  } catch (err) {
    console.error('getUnits error:', err.message);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
};

export const getUnit = async (req, res) => {
  try {
    const result = await query('SELECT * FROM organizations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });
    res.json({ unit: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
};

export const createUnit = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Unit name required' });
    const result = await query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json({ unit: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create unit' });
  }
};

export const updateUnit = async (req, res) => {
  try {
    const { name, settings } = req.body;
    const result = await query(
      `UPDATE organizations SET
         name = COALESCE($2, name),
         settings = COALESCE($3::jsonb, settings)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, settings ? JSON.stringify(settings) : null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });
    res.json({ unit: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update unit' });
  }
};

export const deleteUnit = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM organizations WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete unit' });
  }
};

export const getUnitUsers = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, full_name, role, status, created_at
       FROM users WHERE org_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUnitUser = async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;
    const bcrypt = await import('bcryptjs');
    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username taken' });

    const hash = await bcrypt.default.hash(password, 12);
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, role, org_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, username, full_name, role, status, created_at`,
      [username, hash, fullName || username, role || ROLES.AUDITOR, req.params.id]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('createUnitUser error:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const updateUnitUser = async (req, res) => {
  try {
    const { fullName, role, status } = req.body;
    const check = await query('SELECT id FROM users WHERE id = $1 AND org_id = $2', [req.params.userId, req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await query(
      `UPDATE users SET
         full_name = COALESCE($3, full_name),
         role = COALESCE($4, role),
         status = COALESCE($5, status)
       WHERE id = $1 AND org_id = $2
       RETURNING id, username, full_name, role, status, created_at`,
      [req.params.userId, req.params.id, fullName, role, status]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUnitUser = async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM users WHERE id = $1 AND org_id = $2 RETURNING id',
      [req.params.userId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const getUnitsAudits = async (req, res) => {
  try {
    const result = await query(
      `SELECT o.id as unit_id, o.name as unit_name,
         COUNT(a.id)::int as total_audits,
         COUNT(a.id) FILTER (WHERE a.status = 'submitted')::int as submitted,
         COUNT(a.id) FILTER (WHERE a.status = 'in_progress')::int as in_progress,
         ROUND(AVG(a.overall_score) FILTER (WHERE a.status = 'submitted'))::int as avg_score
       FROM organizations o
       LEFT JOIN audit_records a ON a.org_id = o.id
       GROUP BY o.id, o.name
       ORDER BY o.name`,
    );
    res.json({ units: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
};

export const getUnitAuditsList = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, template_name, template_version, template_category,
              overall_score, passed, status, nc_flags, site_name,
              inspector, audit_date, created_at
       FROM audit_records WHERE org_id = $1
       ORDER BY created_at DESC LIMIT 500`,
      [req.params.id]
    );
    res.json({ audits: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
};
