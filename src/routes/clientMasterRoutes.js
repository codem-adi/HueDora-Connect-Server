import { Router } from 'express';
import {
  createClientMaster,
  deleteProgramDocument,
  getClientMaster,
  getProgramDocument,
  listClientMasters,
  listClientMastersByClient,
  listDivisionsByClient,
  softDeleteClientMaster,
  updateClientMaster,
  uploadProgramDocument,
} from '../controllers/clientMasterController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadProgramPdf } from '../middleware/uploadProgramPdf.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('client-masters:read'), listClientMasters);
router.get(
  '/by-client/:clientId/divisions',
  authorize('client-masters:read', 'camps:edit-pending', 'camps:update', 'camps:create'),
  listDivisionsByClient
);
router.get('/by-client/:clientId', authorize('client-masters:read'), listClientMastersByClient);
router.post('/', authorize('client-masters:create'), createClientMaster);

router.get('/:id/document', authorize('client-masters:read'), getProgramDocument);
router.post('/:id/document', authorize('client-masters:update'), (req, res, next) => {
  uploadProgramPdf(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid PDF upload' });
    }
    return uploadProgramDocument(req, res, next);
  });
});
router.delete('/:id/document', authorize('client-masters:update'), deleteProgramDocument);

router.get('/:id', authorize('client-masters:read'), getClientMaster);
router.put('/:id', authorize('client-masters:update'), updateClientMaster);
router.delete('/:id', authorize('client-masters:delete'), softDeleteClientMaster);

export default router;
