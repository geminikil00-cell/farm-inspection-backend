import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { validateRegistration } from '../middleware/validate.js';

const router = Router();

router.post('/register', validateRegistration, register);
router.post('/login', login);

export default router;
