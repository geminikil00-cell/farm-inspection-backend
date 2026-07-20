import { query } from '../config/db.js';
import { calculateScore } from '../utils/scoreCalc.js';
import { getQuarterAndYear } from '../utils/quarterUtils.js';
import { unlink } from 'fs/promises';
import { resolve } from 'path';

const uploadDir = resolve(process.env.UPLOAD_DIR || './uploads');

export const getRecords = async (req, res) => {
  try {
    const { facility_id, year, quarter } = req.query;
    let sql = `
      SELECT id, facility_id, facility_title, inspector, date, score,
             inspection_year, inspection_quarter, created_at
      FROM inspection_records
      WHERE org_id = $1
    `;
    const params = [req.orgId];
    let idx = 2;

    if (facility_id && facility_id !== 'all') {
      sql += ` AND facility_id = $${idx++}`;
      params.push(facility_id);
    }
    if (year) {
      sql += ` AND inspection_year = $${idx++}`;
      params.push(parseInt(year, 10));
    }
    if (quarter) {
      sql += ` AND inspection_quarter = $${idx++}`;
      params.push(quarter);
    }

    sql += ' ORDER BY date DESC LIMIT 1000';

    const result = await query(sql, params);
    res.json({ records: result.rows });
  } catch (err) {
    console.error('getRecords error:', err.message);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
};

export const getRecord = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM inspection_records WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ record: result.rows[0] });
  } catch (err) {
    console.error('getRecord error:', err.message);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
};

export const createRecord = async (req, res) => {
  try {
    const { facility_id, facility_title, inspector, date, data, photo_paths } = req.body;

    const rows = data?.rows || [];
    const score = calculateScore(rows);
    const { year, quarter } = getQuarterAndYear(date);

    const result = await query(
      `INSERT INTO inspection_records
         (org_id, user_id, facility_id, facility_title, inspector, date,
          score, inspection_year, inspection_quarter, data, photo_paths)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.orgId,
        req.userId,
        facility_id,
        facility_title,
        inspector,
        date,
        score,
        year,
        quarter,
        JSON.stringify(data),
        photo_paths || [],
      ]
    );

    res.status(201).json({ record: result.rows[0] });
  } catch (err) {
    console.error('createRecord error:', err.message);
    res.status(500).json({ error: 'Failed to save record' });
  }
};

export const deleteRecord = async (req, res) => {
  try {
    const fetchResult = await query(
      'SELECT photo_paths FROM inspection_records WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );

    if (fetchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const photo_paths = fetchResult.rows[0].photo_paths || [];

    await query(
      'DELETE FROM inspection_records WHERE id = $1 AND org_id = $2',
      [req.params.id, req.orgId]
    );

    for (const photoPath of photo_paths) {
      try {
        const filePath = resolve(uploadDir, photoPath);
        await unlink(filePath);
      } catch (_) {}
    }

    res.json({ success: true });
  } catch (err) {
    console.error('deleteRecord error:', err.message);
    res.status(500).json({ error: 'Failed to delete record' });
  }
};
