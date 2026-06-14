import { Router } from 'express';
import {
  activateUser,
  approveUser,
  createUser,
  deactivateUser,
  getRolePermissions,
  getUser,
  listUsers,
  rejectUser,
  updateUser,
} from '../controllers/userController.js';
import { authenticate, authorize, requireAdminRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdminRole);

router.get('/roles', authorize('users:read'), getRolePermissions);
router.get('/', authorize('users:read'), listUsers);
router.get('/:id', authorize('users:read'), getUser);
router.post('/', authorize('users:create'), createUser);
router.put('/:id', authorize('users:update'), updateUser);
router.post('/:id/approve', authorize('users:update'), approveUser);
router.post('/:id/reject', authorize('users:update'), rejectUser);
router.post('/:id/activate', authorize('users:update'), activateUser);
router.post('/:id/deactivate', authorize('users:update'), deactivateUser);

export default router;
