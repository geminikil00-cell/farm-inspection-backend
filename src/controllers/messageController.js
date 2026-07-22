import { query, getClient } from '../config/db.js';

export const getThreads = async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*,
         (SELECT content FROM message_contents WHERE message_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message,
         (SELECT created_at FROM message_contents WHERE message_id = m.id ORDER BY created_at DESC LIMIT 1) as last_at,
         array_agg(DISTINCT mp.user_id) as participant_ids
       FROM messages m
       JOIN message_participants mp ON mp.message_id = m.id
       WHERE mp.user_id = $1
       GROUP BY m.id
       ORDER BY last_at DESC NULLS LAST`,
      [req.userId]
    );

    const threads = await Promise.all(result.rows.map(async (t) => {
      const participants = await query(
        `SELECT id, username, full_name, role FROM users WHERE id = ANY($1)`,
        [t.participant_ids]
      );
      return { ...t, participants: participants.rows };
    }));

    res.json({ threads });
  } catch (err) {
    console.error('getThreads error:', err.message);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
};

export const getThread = async (req, res) => {
  try {
    const msg = await query(
      `SELECT m.*, mc.id as content_id, mc.author_id, mc.content, mc.created_at as msg_time,
              u.username, u.full_name
       FROM messages m
       JOIN message_contents mc ON mc.message_id = m.id
       JOIN users u ON u.id = mc.author_id
       WHERE m.id = $1
       ORDER BY mc.created_at ASC`,
      [req.params.id]
    );
    if (msg.rows.length === 0) return res.status(404).json({ error: 'Thread not found' });

    const participants = await query(
      `SELECT u.id, u.username, u.full_name, u.role
       FROM message_participants mp JOIN users u ON u.id = mp.user_id
       WHERE mp.message_id = $1`,
      [req.params.id]
    );

    res.json({
      thread: {
        id: req.params.id,
        subject: msg.rows[0].subject,
        messages: msg.rows.map(r => ({
          id: r.content_id,
          author_id: r.author_id,
          author_name: r.full_name || r.username,
          content: r.content,
          created_at: r.msg_time,
        })),
        participants: participants.rows,
      }
    });
  } catch (err) {
    console.error('getThread error:', err.message);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
};

export const createThread = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { participant_id, subject, content } = req.body;

    const msg = await client.query(
      'INSERT INTO messages (subject) VALUES ($1) RETURNING *',
      [subject || '']
    );
    const messageId = msg.rows[0].id;

    await client.query(
      'INSERT INTO message_participants (message_id, user_id) VALUES ($1, $2), ($1, $3)',
      [messageId, req.userId, participant_id]
    );

    if (content) {
      await client.query(
        'INSERT INTO message_contents (message_id, author_id, content) VALUES ($1, $2, $3)',
        [messageId, req.userId, content]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ thread: msg.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createThread error:', err.message);
    res.status(500).json({ error: 'Failed to create thread' });
  } finally {
    client.release();
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content required' });

    const check = await query(
      'SELECT 1 FROM message_participants WHERE message_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (check.rows.length === 0) return res.status(403).json({ error: 'Not a participant' });

    const result = await query(
      `INSERT INTO message_contents (message_id, author_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.userId, content]
    );

    const user = await query('SELECT full_name, username FROM users WHERE id = $1', [req.userId]);

    res.status(201).json({
      message: {
        ...result.rows[0],
        author_name: user.rows[0]?.full_name || user.rows[0]?.username,
      }
    });
  } catch (err) {
    console.error('sendMessage error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const getRecipients = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, full_name, role, org_id
       FROM users WHERE status = 'active' AND id != $1
       ORDER BY full_name`,
      [req.userId]
    );
    res.json({ recipients: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
};
