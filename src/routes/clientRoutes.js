import { Router } from 'express';
import {
  createClient,
  getClient,
  listClients,
  softDeleteClient,
  updateClient,
} from '../controllers/clientController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('clients:read'), listClients);
router.get('/:id', authorize('clients:read'), getClient);
router.post('/', authorize('clients:create'), createClient);
router.put('/:id', authorize('clients:update'), updateClient);
router.delete('/:id', authorize('clients:delete'), softDeleteClient);

export default router;
