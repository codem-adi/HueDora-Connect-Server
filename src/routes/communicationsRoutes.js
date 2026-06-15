import { Router } from 'express';
import {
  archiveEmailMessage,
  extractEmailMessage,
  extractManualPaste,
  getEmailConfig,
  getEmailMessage,
  getEmailStatus,
  listEmailMessages,
  processEmailMessage,
  processManualPasteMessage,
  restoreEmailMessage,
  saveEmailPreview,
  syncEmailMailbox,
  updateEmailConfig,
} from '../controllers/communicationsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(authorize('communications:read', 'communications:manage', 'communications:configure'));

router.get('/email/status', getEmailStatus);
router.get('/email/config', getEmailConfig);
router.put('/email/config', authorize('communications:configure', 'communications:manage'), updateEmailConfig);
router.get('/email/messages', listEmailMessages);
router.get('/email/messages/:id', getEmailMessage);
router.post('/email/sync', authorize('communications:manage'), syncEmailMailbox);
router.post('/email/messages/:id/extract', authorize('communications:manage'), extractEmailMessage);
router.put('/email/messages/:id/preview', authorize('communications:manage'), saveEmailPreview);
router.post('/email/messages/:id/process', authorize('communications:manage'), processEmailMessage);
router.post('/email/messages/:id/archive', authorize('communications:manage'), archiveEmailMessage);
router.post('/email/messages/:id/restore', authorize('communications:manage'), restoreEmailMessage);

router.post('/paste/extract', authorize('communications:manage'), extractManualPaste);
router.post('/paste/process', authorize('communications:manage'), processManualPasteMessage);

export default router;
