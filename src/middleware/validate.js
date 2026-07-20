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

  if (!facility_id) {
    return res.status(400).json({ error: 'facility_id is required' });
  }
  if (!facility_title) {
    return res.status(400).json({ error: 'facility_title is required' });
  }
  if (!inspector) {
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

export const validateOrgUpdate = (req, res, next) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Organization name must be at least 2 characters' });
  }
  req.body.name = name.trim();
  next();
};

export const validateUserUpdate = (req, res, next) => {
  const { username, password, role, fullName } = req.body;
  if (username !== undefined && (typeof username !== 'string' || username.trim().length < 3)) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  next();
};
