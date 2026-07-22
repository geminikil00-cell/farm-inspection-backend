import { query } from '../config/db.js';

export const getDepartments = async (req, res) => {
  try {
    const { org_id } = req.query;
    const orgId = org_id || req.orgId;
    const result = await query(
      `SELECT d.*, COUNT(ud.user_id)::int as user_count
       FROM departments d
       LEFT JOIN user_departments ud ON ud.department_id = d.id
       WHERE d.org_id = $1
       GROUP BY d.id
       ORDER BY d.name`,
      [orgId]
    );
    res.json({ departments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, org_id } = req.body;
    const orgId = org_id || req.orgId;
    const result = await query(
      'INSERT INTO departments (org_id, name) VALUES ($1, $2) RETURNING *',
      [orgId, name.trim()]
    );
    res.status(201).json({ department: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create department' });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    await query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete department' });
  }
};

export const addUserToDepartment = async (req, res) => {
  try {
    await query(
      'INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.userId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add user' });
  }
};

export const removeUserFromDepartment = async (req, res) => {
  try {
    await query(
      'DELETE FROM user_departments WHERE user_id = $1 AND department_id = $2',
      [req.params.userId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove user' });
  }
};

export const getDepartmentUsers = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.role
       FROM user_departments ud
       JOIN users u ON u.id = ud.user_id
       WHERE ud.department_id = $1`,
      [req.params.id]
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
