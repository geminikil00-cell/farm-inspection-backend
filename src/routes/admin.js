import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateOrgUpdate, validateUserUpdate } from '../middleware/validate.js';
import { ROLES } from '../config/roles.js';
import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';

const router = Router();

router.use(authenticate);

// ── Organization ──

router.get('/org', async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, COUNT(u.id)::int as user_count
       FROM organizations o
       LEFT JOIN users u ON u.org_id = o.id AND u.status = 'active'
       WHERE o.id = $1
       GROUP BY o.id`,
      [req.orgId]
    );
    res.json({ org: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.put('/org', validateOrgUpdate, async (req, res) => {
  try {
    if (![ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN].includes(req.role)) {
      return res.status(403).json({ error: 'Only admins can update organization' });
    }

    const { name, logo_url, settings } = req.body;
    const result = await query(
      `UPDATE organizations SET
         name = COALESCE($2, name),
         logo_url = COALESCE($3, logo_url),
         settings = COALESCE($4::jsonb, settings)
       WHERE id = $1
       RETURNING *`,
      [req.orgId, name, logo_url, settings ? JSON.stringify(settings) : null]
    );
    res.json({ org: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ── Users ──

router.get('/org/users', async (req, res) => {
  try {
    if (![ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN].includes(req.role)) {
      return res.status(403).json({ error: 'Only admins can manage users' });
    }

    const result = await query(
      `SELECT id, username, full_name, role, status, created_at
       FROM users WHERE org_id = $1
       ORDER BY created_at DESC`,
      [req.orgId]
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/org/users', validateUserUpdate, async (req, res) => {
  try {
    if (![ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN].includes(req.role)) {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    const { username, password, fullName, role } = req.body;

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, role, org_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, username, full_name, role, status, created_at`,
      [username, password_hash, fullName || username, role || ROLES.AUDITOR, req.orgId]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Create user error:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/org/users/:id', validateUserUpdate, async (req, res) => {
  try {
    if (![ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN].includes(req.role)) {
      return res.status(403).json({ error: 'Only admins can update users' });
    }

    const { fullName, role, status } = req.body;

    const check = await query(
      'SELECT id FROM users WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await query(
      `UPDATE users SET
         full_name = COALESCE($3, full_name),
         role = COALESCE($4, role),
         status = COALESCE($5, status)
       WHERE id = $1 AND org_id = $2
       RETURNING id, username, full_name, role, status, created_at`,
      [req.params.id, req.orgId, fullName, role, status]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/org/users/:id', async (req, res) => {
  try {
    if (![ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN].includes(req.role)) {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 AND org_id = $2 RETURNING id',
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
