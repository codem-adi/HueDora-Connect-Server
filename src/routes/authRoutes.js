import { Router } from 'express';
import { login, refresh, me, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

export default router;
