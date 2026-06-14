import { Router } from 'express';
import {
  getImportFields,
  parseUpload,
  previewImport,
  confirmImport,
  listTemplates,
  saveTemplate,
  deleteTemplate,
  downloadSampleExcel,
} from '../controllers/importController.js';
import { authenticate, authorize, requireSuperAdmin } from '../middleware/auth.js';
import { uploadExcel } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);

router.get('/fields', authorize('import:read'), getImportFields);
router.get('/sample', authorize('import:read'), downloadSampleExcel);
router.get('/templates', authorize('import:read'), requireSuperAdmin, listTemplates);
router.post('/templates', authorize('import:create'), requireSuperAdmin, saveTemplate);
router.delete('/templates/:id', authorize('import:create'), requireSuperAdmin, deleteTemplate);

router.post(
  '/parse',
  authorize('import:create'),
  (req, res, next) => {
    uploadExcel(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  parseUpload
);

router.post('/preview', authorize('import:create'), previewImport);
router.post('/confirm', authorize('import:create'), confirmImport);

export default router;
