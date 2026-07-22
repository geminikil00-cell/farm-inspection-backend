import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const { language } = req.body;
    await query(
      `UPDATE users SET
         language = COALESCE($2, language)
       WHERE id = $1`,
      [req.userId, language]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;
