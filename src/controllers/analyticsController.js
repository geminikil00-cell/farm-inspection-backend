import { query } from '../config/db.js';
import { getStatusDistribution } from '../utils/scoreCalc.js';
import { FACILITY_TRANSLATIONS } from '../translations/criteria.js';

const FACILITY_IDS = [
  'greenhouses', 'warehouses', 'irrigation', 'nursery', 'pesticides',
  'accommodation', 'workshop', 'scrap', 'lakes', 'packing',
  'femaleRestArea', 'maleRestArea', 'generalFacilities',
];

const getAverageScore = (records) => {
  if (!records || records.length === 0) return 0;
  return Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length);
};

function classifyInRow(row) {
  for (let i = 0; i <= 6; i++) {
    const val = i === 0 ? row.status : row[`status_${i}`];
    if (!val) continue;
    const s = val.trim();
    if (['ممتاز', 'Excellent', '优'].some((v) => s.includes(v))) return 'Excellent';
    if (['جيد جداً', 'Very Good', '良'].some((v) => s.includes(v))) return 'VeryGood';
    if (['جيد', 'Good', '可'].some((v) => s.includes(v))) return 'Good';
    if (['مقبول', 'Acceptable', '不可'].some((v) => s.includes(v))) return 'Acceptable';
    if (['سيء', 'Bad', '极'].some((v) => s.includes(v))) return 'Bad';
  }
  return null;
}

export const getSummary = async (req, res) => {
  try {
    const { year, quarter } = req.query;

    let sql = 'SELECT * FROM inspection_records WHERE org_id = $1';
    const params = [req.orgId];
    let idx = 2;

    if (year) {
      sql += ` AND inspection_year = $${idx++}`;
      params.push(parseInt(year, 10));
    }
    if (quarter) {
      sql += ` AND inspection_quarter = $${idx++}`;
      params.push(quarter);
    }
    sql += ' ORDER BY date ASC';

    const result = await query(sql, params);
    const records = result.rows;

    const averageScore = getAverageScore(records);
    const recordCount = records.length;

    const quarterTrend = {};
    records.forEach((r) => {
      const qKey = `${r.inspection_year}-${r.inspection_quarter}`;
      if (!quarterTrend[qKey]) {
        quarterTrend[qKey] = {
          key: qKey,
          name: `${r.inspection_year} ${r.inspection_quarter}`,
          total: 0,
          count: 0,
        };
      }
      quarterTrend[qKey].total += r.score;
      quarterTrend[qKey].count += 1;
    });

    const trendData = Object.values(quarterTrend)
      .map((q) => ({
        date: q.name,
        key: q.key,
        score: Math.round(q.total / q.count),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const facilityScores = {};
    records.forEach((r) => {
      if (!facilityScores[r.facility_id]) {
        facilityScores[r.facility_id] = { name: r.facility_title, total: 0, count: 0 };
      }
      facilityScores[r.facility_id].total += r.score;
      facilityScores[r.facility_id].count += 1;
    });

    const comparisonData = Object.entries(facilityScores)
      .map(([key, val]) => ({
        key,
        name: val.name,
        average: Math.round(val.total / val.count),
      }))
      .sort((a, b) => b.average - a.average);

    const radarData = FACILITY_IDS.map((fid) => {
      const matching = records.filter((r) => r.facility_id === fid);
      const arTitle = FACILITY_TRANSLATIONS.ar?.[fid]?.title || fid;
      const enTitle = FACILITY_TRANSLATIONS.en?.[fid]?.title || fid;
      return {
        subject: arTitle,
        enSubject: enTitle,
        score: getAverageScore(matching),
        count: matching.length,
      };
    });

    const statusCounts = getStatusDistribution(records);

    const pieData = [
      { name: 'Excellent', labelAr: 'ممتاز', value: statusCounts.Excellent, color: '#22c55e' },
      { name: 'VeryGood', labelAr: 'جيد جداً', value: statusCounts.VeryGood, color: '#3b82f6' },
      { name: 'Good', labelAr: 'جيد', value: statusCounts.Good, color: '#06b6d4' },
      { name: 'Acceptable', labelAr: 'مقبول', value: statusCounts.Acceptable, color: '#eab308' },
      { name: 'Bad', labelAr: 'سيء', value: statusCounts.Bad, color: '#ef4444' },
    ].filter((d) => d.value > 0);

    const quarterMap = {};
    records.forEach((r) => {
      const qKey = `${r.inspection_year}-${r.inspection_quarter}`;
      if (!quarterMap[qKey]) {
        quarterMap[qKey] = {
          key: qKey,
          name: `${r.inspection_year} ${r.inspection_quarter}`,
          Excellent: 0,
          VeryGood: 0,
          Good: 0,
          Acceptable: 0,
          Bad: 0,
        };
      }
      if (r.data && Array.isArray(r.data.rows)) {
        r.data.rows.forEach((row) => {
          const classified = classifyInRow(row);
          if (classified) quarterMap[qKey][classified]++;
        });
      }
    });

    const quarterlyStatusData = Object.values(quarterMap).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    res.json({
      recordCount,
      averageScore,
      trendData,
      comparisonData,
      radarData,
      pieData,
      quarterlyStatusData,
    });
  } catch (err) {
    console.error('getSummary error:', err.message);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
};

export const getComparison = async (req, res) => {
  try {
    const { mode, timeA_year, timeA_quarter, timeB_year, timeB_quarter, locA, locB, loc_year, loc_quarter } = req.query;

    if (mode === 'time') {
      const recordsA = await fetchRecords(req.orgId, timeA_year, timeA_quarter);
      const recordsB = await fetchRecords(req.orgId, timeB_year, timeB_quarter);

      const avgA = getAverageScore(recordsA);
      const avgB = getAverageScore(recordsB);

      const radarData = FACILITY_IDS.map((fid) => {
        const arTitle = FACILITY_TRANSLATIONS.ar?.[fid]?.title || fid;
        return {
          subject: arTitle,
          A: getAverageScore(recordsA.filter((r) => r.facility_id === fid)),
          B: getAverageScore(recordsB.filter((r) => r.facility_id === fid)),
        };
      });

      const distA = getStatusDistribution(recordsA);
      const distB = getStatusDistribution(recordsB);

      const barData = [
        { name: 'Excellent', A: distA.Excellent, B: distB.Excellent },
        { name: 'VeryGood', A: distA.VeryGood, B: distB.VeryGood },
        { name: 'Good', A: distA.Good, B: distB.Good },
        { name: 'Acceptable', A: distA.Acceptable, B: distB.Acceptable },
        { name: 'Bad', A: distA.Bad, B: distB.Bad },
      ];

      res.json({
        avgA, avgB, delta: avgB - avgA,
        countA: recordsA.length, countB: recordsB.length,
        radarData, barData,
      });
    } else if (mode === 'location') {
      const recordsA = await fetchRecordsForFacility(req.orgId, locA, loc_year, loc_quarter);
      const recordsB = await fetchRecordsForFacility(req.orgId, locB, loc_year, loc_quarter);

      const avgA = getAverageScore(recordsA);
      const avgB = getAverageScore(recordsB);

      const allRecords = await query(
        'SELECT * FROM inspection_records WHERE org_id = $1 ORDER BY date ASC',
        [req.orgId]
      );
      const all = allRecords.rows.filter(
        (r) => r.facility_id === locA || r.facility_id === locB
      );

      const titleA = FACILITY_TRANSLATIONS.ar?.[locA]?.title || locA;
      const titleB = FACILITY_TRANSLATIONS.ar?.[locB]?.title || locB;

      const timeTrendMap = {};
      all.forEach((r) => {
        const key = `${r.inspection_year}-${r.inspection_quarter}`;
        if (!timeTrendMap[key]) {
          timeTrendMap[key] = {
            key, name: `${r.inspection_year} ${r.inspection_quarter}`,
            countA: 0, totalA: 0, countB: 0, totalB: 0,
          };
        }
        if (r.facility_id === locA) {
          timeTrendMap[key].totalA += r.score;
          timeTrendMap[key].countA++;
        } else if (r.facility_id === locB) {
          timeTrendMap[key].totalB += r.score;
          timeTrendMap[key].countB++;
        }
      });

      const trendData = Object.values(timeTrendMap)
        .map((item) => ({
          name: item.name,
          key: item.key,
          [titleA]: item.countA > 0 ? Math.round(item.totalA / item.countA) : null,
          [titleB]: item.countB > 0 ? Math.round(item.totalB / item.countB) : null,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));

      const distA = getStatusDistribution(recordsA);
      const distB = getStatusDistribution(recordsB);

      const barData = [
        { name: 'Excellent', [titleA]: distA.Excellent, [titleB]: distB.Excellent },
        { name: 'VeryGood', [titleA]: distA.VeryGood, [titleB]: distB.VeryGood },
        { name: 'Good', [titleA]: distA.Good, [titleB]: distB.Good },
        { name: 'Acceptable', [titleA]: distA.Acceptable, [titleB]: distB.Acceptable },
        { name: 'Bad', [titleA]: distA.Bad, [titleB]: distB.Bad },
      ];

      res.json({
        avgA, avgB, delta: avgB - avgA,
        countA: recordsA.length, countB: recordsB.length,
        trendData, barData, titleA, titleB,
      });
    } else {
      res.status(400).json({ error: 'Invalid mode. Use "time" or "location".' });
    }
  } catch (err) {
    console.error('getComparison error:', err.message);
    res.status(500).json({ error: 'Failed to compute comparison' });
  }
};

async function fetchRecords(orgId, year, quarter) {
  let sql = 'SELECT * FROM inspection_records WHERE org_id = $1';
  const params = [orgId];
  let idx = 2;

  if (year) {
    sql += ` AND inspection_year = $${idx++}`;
    params.push(parseInt(year, 10));
  }
  if (quarter) {
    sql += ` AND inspection_quarter = $${idx++}`;
    params.push(quarter);
  }

  const result = await query(sql, params);
  return result.rows;
}

async function fetchRecordsForFacility(orgId, fid, year, quarter) {
  let sql = 'SELECT * FROM inspection_records WHERE org_id = $1 AND facility_id = $2';
  const params = [orgId, fid];
  let idx = 3;

  if (year) {
    sql += ` AND inspection_year = $${idx++}`;
    params.push(parseInt(year, 10));
  }
  if (quarter) {
    sql += ` AND inspection_quarter = $${idx++}`;
    params.push(quarter);
  }

  const result = await query(sql, params);
  return result.rows;
}
