import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { validateRegistration } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', validateRegistration, register);
router.post('/login', login);
router.get('/me', authenticate, getMe);

export default router;
