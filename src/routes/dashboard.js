import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/db.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [
      ncStats,
      auditStats,
      myNCs,
      myAudits,
      recentAudits,
      userCount,
    ] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE status = 'open')::int as open_count,
           COUNT(*) FILTER (WHERE status IN ('in_progress','assigned'))::int as in_progress,
           COUNT(*) FILTER (WHERE status IN ('action_taken','under_review'))::int as under_review,
           COUNT(*) FILTER (WHERE status = 'closed')::int as closed,
           COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'closed')::int as overdue,
           COUNT(*) FILTER (WHERE assigned_to = $2)::int as assigned_to_me
         FROM nc_records WHERE org_id = $1`,
        [req.orgId, req.userId]
      ),
      query(
        `SELECT
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress,
           COUNT(*) FILTER (WHERE status = 'submitted')::int as submitted,
           COUNT(*) FILTER (WHERE status = 'submitted' AND passed = true)::int as passed,
           ROUND(AVG(overall_score) FILTER (WHERE status = 'submitted'))::int as avg_score
         FROM audit_records WHERE org_id = $1`,
        [req.orgId]
      ),
      query(
        `SELECT COUNT(*)::int as count FROM nc_records
         WHERE org_id = $1 AND assigned_to = $2 AND status != 'closed'`,
        [req.orgId, req.userId]
      ),
      query(
        `SELECT COUNT(*)::int as count FROM audit_records
         WHERE org_id = $1 AND auditor_id = $2 AND status = 'in_progress'`,
        [req.orgId, req.userId]
      ),
      query(
        `SELECT id, template_name, overall_score, passed, status, audit_date, site_name, inspector
         FROM audit_records WHERE org_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [req.orgId]
      ),
      query(
        `SELECT COUNT(*)::int as count FROM users
         WHERE org_id = $1 AND status = 'active'`,
        [req.orgId]
      ),
    ]);

    res.json({
      nc: ncStats.rows[0],
      audits: auditStats.rows[0],
      myNCs: myNCs.rows[0].count,
      myAudits: myAudits.rows[0].count,
      recentAudits: recentAudits.rows,
      userCount: userCount.rows[0].count,
      role: req.role,
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
