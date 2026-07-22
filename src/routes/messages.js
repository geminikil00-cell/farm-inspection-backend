import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getThreads, getThread, createThread, sendMessage, getRecipients,
} from '../controllers/messageController.js';

const router = Router();
router.use(authenticate);

router.get('/threads', getThreads);
router.get('/recipients', getRecipients);
router.get('/:id', getThread);
router.post('/', createThread);
router.post('/:id/reply', sendMessage);

export default router;
