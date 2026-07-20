const STATUS_SCORE_MAP = {
  'ممتاز': 100,
  'جيد جداً': 80,
  'جيد': 60,
  'مقبول': 40,
  'سيء': 0,
};

export const calculateScore = (rows) => {
  if (!Array.isArray(rows)) return 0;

  let totalScore = 0;
  let count = 0;

  rows.forEach((row) => {
    if (row.status && STATUS_SCORE_MAP[row.status] !== undefined) {
      totalScore += STATUS_SCORE_MAP[row.status];
      count++;
    }
    for (let i = 1; i <= 6; i++) {
      const key = `status_${i}`;
      if (row[key] && STATUS_SCORE_MAP[row[key]] !== undefined) {
        totalScore += STATUS_SCORE_MAP[row[key]];
        count++;
      }
    }
  });

  return count === 0 ? 0 : Math.round(totalScore / count);
};

export const classifyStatus = (statusVal) => {
  if (!statusVal) return null;
  const s = statusVal.trim();
  if (['ممتاز', 'Excellent', '优'].some((v) => s.includes(v))) return 'Excellent';
  if (['جيد جداً', 'Very Good', '良'].some((v) => s.includes(v))) return 'VeryGood';
  if (['جيد', 'Good', '可'].some((v) => s.includes(v))) return 'Good';
  if (['مقبول', 'Acceptable', '不可'].some((v) => s.includes(v))) return 'Acceptable';
  if (['سيء', 'Bad', '极'].some((v) => s.includes(v))) return 'Bad';
  return null;
};

export const getStatusDistribution = (records) => {
  const counts = { Excellent: 0, VeryGood: 0, Good: 0, Acceptable: 0, Bad: 0 };
  records.forEach((r) => {
    if (r.data && Array.isArray(r.data.rows)) {
      r.data.rows.forEach((row) => {
        const statusKey = classifyStatus(row.status);
        if (statusKey) counts[statusKey]++;
        for (let i = 1; i <= 6; i++) {
          const key = `status_${i}`;
          const sk = classifyStatus(row[key]);
          if (sk) counts[sk]++;
        }
      });
    }
  });
  return counts;
};
