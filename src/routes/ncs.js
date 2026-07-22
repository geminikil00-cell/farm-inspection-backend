import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getNCs, getNC, createNC, updateNCStatus, updateNC, addNCTimelineEntry, getNCStats,
} from '../controllers/ncController.js';

const router = Router();
router.use(authenticate);

router.get('/stats', getNCStats);
router.get('/', getNCs);
router.get('/:id', getNC);
router.post('/', createNC);
router.put('/:id', updateNC);
router.post('/:id/status', updateNCStatus);
router.post('/:id/timeline', addNCTimelineEntry);

export default router;
