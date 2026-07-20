import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getSummary, getComparison } from '../controllers/analyticsController.js';

const router = Router();

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/comparison', getComparison);

export default router;
