import { query } from '../config/db.js';
import { ROLES } from '../config/roles.js';

export async function createNotification(client, { recipientId, unitId, title, details, type, tone, relatedId }) {
  await client.query(
    `INSERT INTO notifications (recipient_id, unit_id, title, details, type, tone, related_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [recipientId, unitId, title, details, type, tone || 'info', relatedId]
  );
}

export async function notifyAdmins(client, { title, details, type, unitId, relatedId }) {
  const admins = await client.query(
    `SELECT id FROM users WHERE role IN ($1, $2) AND status = 'active'`,
    [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN]
  );
  for (const admin of admins.rows) {
    await createNotification(client, {
      recipientId: admin.id,
      unitId,
      title,
      details,
      type,
      tone: 'info',
      relatedId,
    });
  }
}

export const getNotifications = async (req, res) => {
  try {
    const { unread } = req.query;
    let sql = 'SELECT * FROM notifications WHERE recipient_id = $1';
    const params = [req.userId];

    if (unread === 'true') {
      sql += ' AND read_status = false';
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const result = await query(sql, params);
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('getNotifications error:', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const markRead = async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET read_status = true WHERE id = $1 AND recipient_id = $2',
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET read_status = true WHERE recipient_id = $1 AND read_status = false',
      [req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*)::int as count FROM notifications WHERE recipient_id = $1 AND read_status = false',
      [req.userId]
    );
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};
