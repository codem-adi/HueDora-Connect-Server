import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import {
  getEmailFormat,
  pollEmailInbox,
  receiveEmailWebhook,
} from '../controllers/emailController.js';
import { parseRawEmail } from '../services/emailClient.js';
import { processIncomingEmail } from '../services/emailIngestService.js';

const router = Router();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/format', getEmailFormat);
router.post('/poll', pollEmailInbox);

router.post(
  '/webhook',
  express.json({ limit: '15mb' }),
  receiveEmailWebhook
);

router.post(
  '/webhook/raw',
  express.raw({ type: '*/*', limit: '15mb' }),
  async (req, res, next) => {
    try {
      const secret = process.env.EMAIL_WEBHOOK_SECRET;
      const headerSecret = req.get('X-Email-Ingest-Secret');
      if (secret && headerSecret !== secret) {
        return res.status(401).json({ message: 'Invalid email webhook secret' });
      }

      const parsed = await parseRawEmail(req.body);
      res.status(202).json({ message: 'Email accepted for processing' });

      processIncomingEmail(parsed, 'webhook-raw')
        .then((result) => console.log('[email] Raw webhook processed:', result.messageId, result.status))
        .catch((error) => console.error('[email] Raw webhook failed:', error));
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/webhook/sendgrid',
  upload.none(),
  async (req, res, next) => {
    try {
      const secret = process.env.EMAIL_WEBHOOK_SECRET;
      const headerSecret = req.get('X-Email-Ingest-Secret');
      if (secret && headerSecret !== secret) {
        return res.status(401).json({ message: 'Invalid email webhook secret' });
      }

      const rawEmail = req.body.email || req.body.raw;
      if (!rawEmail) {
        return res.status(400).json({ message: 'SendGrid payload missing email field' });
      }

      const parsed = await parseRawEmail(Buffer.from(rawEmail));
      res.status(202).json({ message: 'Email accepted for processing' });

      processIncomingEmail(parsed, 'webhook-sendgrid')
        .then((result) => console.log('[email] SendGrid processed:', result.messageId, result.status))
        .catch((error) => console.error('[email] SendGrid failed:', error));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
