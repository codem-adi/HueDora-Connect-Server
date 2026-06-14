import { Router } from 'express';
import {
  listCamps,
  getCamp,
  createCamp,
  updateCamp,
  submitForReview,
  approveCamp,
  rejectCamp,
  cancelCamp,
  rescheduleCamp,
  executeCamp,
  softDeleteCamp,
  bulkAction,
} from '../controllers/campController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('camps:read'), listCamps);
router.post('/bulk-action', authorize('camps:update', 'camps:approve', 'camps:review', 'camps:execute'), bulkAction);
router.get('/:id', authorize('camps:read'), getCamp);
router.post('/', authorize('camps:create', 'camps:update'), createCamp);
router.put('/:id', authorize('camps:update', 'camps:approve'), updateCamp);
router.post('/:id/submit-review', authorize('camps:update'), submitForReview);
router.post('/:id/approve', authorize('camps:approve'), approveCamp);
router.post('/:id/reject', authorize('camps:review', 'camps:approve'), rejectCamp);
router.post('/:id/cancel', authorize('camps:cancel'), cancelCamp);
router.post('/:id/reschedule', authorize('camps:reschedule'), rescheduleCamp);
router.post('/:id/execute', authorize('camps:execute'), executeCamp);
router.delete('/:id', authorize('camps:update', 'camps:approve'), softDeleteCamp);

export default router;
