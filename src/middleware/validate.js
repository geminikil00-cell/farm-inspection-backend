export const validateRegistration = (req, res, next) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  req.body.username = username.trim();
  next();
};

export const validateRecord = (req, res, next) => {
  const { facility_id, facility_title, inspector, date, data } = req.body;

  if (!facility_id || typeof facility_id !== 'string') {
    return res.status(400).json({ error: 'facility_id is required' });
  }
  if (!facility_title || typeof facility_title !== 'string') {
    return res.status(400).json({ error: 'facility_title is required' });
  }
  if (!inspector || typeof inspector !== 'string') {
    return res.status(400).json({ error: 'inspector is required' });
  }
  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'data object is required' });
  }

  next();
};
