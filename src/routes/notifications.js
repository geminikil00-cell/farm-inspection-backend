import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getNotifications, markRead, markAllRead, getUnreadCount,
} from '../controllers/notificationController.js';

const router = Router();
router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markRead);
router.put('/mark-all-read', markAllRead);

export default router;
