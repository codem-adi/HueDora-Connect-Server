import { Router } from 'express';
import { getDashboardStats, listClients } from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/stats', authorize('dashboard:read'), getDashboardStats);
router.get('/clients', authorize('clients:read'), listClients);

export default router;
