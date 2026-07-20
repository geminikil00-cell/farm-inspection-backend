import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.array('photos', 20), (req, res) => {
  const filePaths = (req.files || []).map((f) => f.filename);
  res.json({ photo_paths: filePaths });
});

export default router;
