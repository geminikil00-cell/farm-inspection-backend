import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { getSummary, getComparison } from '../controllers/analyticsController.js';

const router = Router();
router.use(authenticate);

router.get('/summary', getSummary);
router.get('/comparison', getComparison);

// Audit analytics
router.get('/audits', async (req, res) => {
  try {
    const { year } = req.query;

    const [
      trendResult,
      templateResult,
      monthlyResult,
      overallResult,
    ] = await Promise.all([
      query(
        `SELECT
           template_name, template_category,
           COUNT(*)::int as count,
           ROUND(AVG(overall_score))::int as avg_score,
           COUNT(*) FILTER (WHERE passed = true)::int as passed_count
         FROM audit_records
         WHERE org_id = $1 AND status = 'submitted'
         ${year ? 'AND EXTRACT(YEAR FROM audit_date) = $2' : ''}
         GROUP BY template_name, template_category
         ORDER BY avg_score DESC`,
        year ? [req.orgId, parseInt(year)] : [req.orgId]
      ),
      query(
        `SELECT
           TO_CHAR(audit_date, 'YYYY-MM') as month,
           COUNT(*)::int as total,
           ROUND(AVG(overall_score))::int as avg_score,
           COUNT(*) FILTER (WHERE passed = true)::int as passed
         FROM audit_records
         WHERE org_id = $1 AND status = 'submitted'
           AND audit_date > NOW() - INTERVAL '12 months'
         GROUP BY month ORDER BY month`,
        [req.orgId]
      ),
      query(
        `SELECT
           TO_CHAR(audit_date, 'YYYY-MM') as month,
           template_category,
           COUNT(*)::int as count
         FROM audit_records
         WHERE org_id = $1 AND status = 'submitted'
           AND audit_date > NOW() - INTERVAL '12 months'
         GROUP BY month, template_category
         ORDER BY month`,
        [req.orgId]
      ),
      query(
        `SELECT
           COUNT(*)::int as total_submitted,
           ROUND(AVG(overall_score))::int as overall_avg,
           COUNT(*) FILTER (WHERE passed = true)::int as total_passed,
           COUNT(*)::int as total_all
         FROM audit_records
         WHERE org_id = $1 AND status = 'submitted'`,
        [req.orgId]
      ),
    ]);

    res.json({
      byTemplate: templateResult.rows,
      monthly: monthlyResult.rows,
      categoryMonthly: monthlyResult.rows.length > 0 ? pivotCategories(monthlyResult.rows) : [],
      overall: overallResult.rows[0],
    });
  } catch (err) {
    console.error('Audit analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit analytics' });
  }
});

// NC analytics
router.get('/ncs', async (req, res) => {
  try {
    const [
      severityResult,
      statusResult,
      closureResult,
    ] = await Promise.all([
      query(
        `SELECT severity, COUNT(*)::int as count
         FROM nc_records WHERE org_id = $1
         GROUP BY severity ORDER BY
           CASE severity WHEN 'Critical' THEN 1 WHEN 'Major' THEN 2 WHEN 'Minor' THEN 3 ELSE 4 END`,
        [req.orgId]
      ),
      query(
        `SELECT status, COUNT(*)::int as count
         FROM nc_records WHERE org_id = $1
         GROUP BY status`,
        [req.orgId]
      ),
      query(
        `SELECT
           ROUND(AVG(EXTRACT(DAY FROM (closed_at - created_at)))::numeric, 1) as avg_days,
           COUNT(*) FILTER (WHERE closed_at IS NOT NULL)::int as closed_count,
           COUNT(*)::int as total
         FROM nc_records WHERE org_id = $1`,
        [req.orgId]
      ),
    ]);

    res.json({
      severity: severityResult.rows,
      status: statusResult.rows,
      closure: closureResult.rows[0],
    });
  } catch (err) {
    console.error('NC analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch NC analytics' });
  }
});

// CSV export
router.get('/export/audits', async (req, res) => {
  try {
    const result = await query(
      `SELECT template_name, template_category, site_name, inspector, audit_date,
              overall_score, passed, status, nc_flags, created_at
       FROM audit_records WHERE org_id = $1
       ORDER BY created_at DESC LIMIT 5000`,
      [req.orgId]
    );

    const rows = result.rows;
    const headers = 'Template,Category,Site,Inspector,Date,Score,Passed,Status,NCs,Created\n';
    const csv = rows.map(r =>
      `"${r.template_name}","${r.template_category}","${r.site_name||''}","${r.inspector||''}","${r.audit_date}",${r.overall_score},${r.passed},"${r.status}",${r.nc_flags},"${r.created_at}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audits.csv');
    res.send(headers + csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/export/ncs', async (req, res) => {
  try {
    const result = await query(
      `SELECT n.nc_number, n.severity, n.category, n.description, n.status,
              u.username as assigned_to, n.due_date, n.closed_at, n.created_at
       FROM nc_records n
       LEFT JOIN users u ON u.id = n.assigned_to
       WHERE n.org_id = $1
       ORDER BY n.created_at DESC LIMIT 5000`,
      [req.orgId]
    );

    const rows = result.rows;
    const headers = 'NC Number,Severity,Category,Description,Status,Assigned To,Due Date,Closed,Created\n';
    const csv = rows.map(r =>
      `"${r.nc_number}","${r.severity}","${r.category}","${(r.description||'').replace(/"/g,'""')}","${r.status}","${r.assigned_to||''}","${r.due_date||''}","${r.closed_at||''}","${r.created_at}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ncs.csv');
    res.send(headers + csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

function pivotCategories(rows) {
  const categories = [...new Set(rows.map(r => r.template_category))];
  const months = [...new Set(rows.map(r => r.month))].sort();
  return months.map(m => {
    const entry = { month: m };
    categories.forEach(c => {
      const found = rows.find(r => r.month === m && r.template_category === c);
      entry[c] = found ? found.count : 0;
    });
    return entry;
  });
}

export default router;
