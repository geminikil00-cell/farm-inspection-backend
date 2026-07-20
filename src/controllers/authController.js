import { query, getClient } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ROLES } from '../config/roles.js';

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      orgId: user.org_id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const userResponse = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.full_name,
  role: user.role,
  orgId: user.org_id,
  orgName: user.org_name,
});

export const register = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { username, password, fullName, orgName } = req.body;

    const existing = await client.query('SELECT id FROM users WHERE username = $1', [
      username,
    ]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Username already taken' });
    }

    const orgNameVal = (orgName || `${username}'s Organization`).trim();
    const orgResult = await client.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
      [orgNameVal]
    );
    const org = orgResult.rows[0];

    const password_hash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (username, password_hash, full_name, role, org_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, username, full_name, role, org_id`,
      [username, password_hash, fullName || username, ROLES.ORG_ADMIN, org.id]
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    const token = generateToken({ ...user, org_id: org.id });
    res.status(201).json({
      token,
      user: userResponse({ ...user, org_name: org.name }),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await query(
      `SELECT u.*, o.name as org_name
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: userResponse(user),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, o.name as org_name
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       WHERE u.id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userResponse(result.rows[0]) });
  } catch (err) {
    console.error('getMe error:', err.message);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};
