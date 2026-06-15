import {
  archiveInboundEmailRecord,
  extractInboundEmailPreview,
  getCommunicationsEmailStatus,
  getInboundEmailById,
  listInboundEmails,
  processInboundEmailRecord,
  restoreInboundEmailRecord,
  saveInboundEmailPreview,
  syncImapMailbox,
} from '../services/inboundEmailService.js';
import {
  extractManualPastePreview,
  processManualPaste,
} from '../services/manualPasteService.js';
import {
  getEmailIngestConfig,
  updateEmailIngestConfig,
} from '../services/emailIngestConfigService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getEmailConfig = asyncHandler(async (req, res) => {
  const data = await getEmailIngestConfig();
  res.json({ data });
});

export const updateEmailConfig = asyncHandler(async (req, res) => {
  const data = await updateEmailIngestConfig(req.body, req.user._id);
  res.json({ data });
});

export const getEmailStatus = asyncHandler(async (req, res) => {
  const data = await getCommunicationsEmailStatus();
  res.json({ data });
});

export const listEmailMessages = asyncHandler(async (req, res) => {
  const result = await listInboundEmails(req.query);
  res.json(result);
});

export const getEmailMessage = asyncHandler(async (req, res) => {
  const data = await getInboundEmailById(req.params.id);
  if (!data) {
    return res.status(404).json({ message: 'Email not found' });
  }
  res.json({ data });
});

export const syncEmailMailbox = asyncHandler(async (req, res) => {
  const data = await syncImapMailbox({
    dateFrom: req.body?.dateFrom,
    dateTo: req.body?.dateTo,
  });

  const message = data.failed
    ? `Synced ${data.synced} email(s); ${data.failed} failed to store`
    : `Synced ${data.synced} email(s) from mailbox`;

  res.json({ data, message });
});

export const extractEmailMessage = asyncHandler(async (req, res) => {
  const force = req.body?.force === true || req.query?.force === 'true';
  const data = await extractInboundEmailPreview(req.params.id, { force });
  res.json({ data });
});

export const saveEmailPreview = asyncHandler(async (req, res) => {
  const data = await saveInboundEmailPreview(req.params.id, req.body?.previewData);
  res.json({ data, message: 'Extraction preview saved' });
});

export const processEmailMessage = asyncHandler(async (req, res) => {
  const data = await processInboundEmailRecord(req.params.id, req.user, {
    previewData: req.body?.previewData,
  });
  res.json({ data, message: `Created ${data.created} camp(s) from email` });
});

export const archiveEmailMessage = asyncHandler(async (req, res) => {
  const data = await archiveInboundEmailRecord(req.params.id, req.user);
  res.json({ data, message: 'Email moved to archive' });
});

export const restoreEmailMessage = asyncHandler(async (req, res) => {
  const data = await restoreInboundEmailRecord(req.params.id);
  res.json({ data, message: 'Email restored to inbox' });
});

export const extractManualPaste = asyncHandler(async (req, res) => {
  const data = await extractManualPastePreview({
    text: req.body?.text,
  });
  res.json({ data });
});

export const processManualPasteMessage = asyncHandler(async (req, res) => {
  const data = await processManualPaste({
    previewData: req.body?.previewData,
    text: req.body?.text,
  }, req.user);
  res.json({ data, message: `Created ${data.created} camp(s) from pasted content` });
});
