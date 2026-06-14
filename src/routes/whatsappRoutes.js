import { Router } from 'express';
import express from 'express';
import {
  getMessageFormat,
  receiveWebhook,
  verifyWebhook,
} from '../controllers/whatsappController.js';

const router = Router();

function captureRawBody(req, res, buf) {
  req.rawBody = buf;
}

router.get('/webhook', verifyWebhook);
router.post(
  '/webhook',
  express.json({ verify: captureRawBody, limit: '1mb' }),
  receiveWebhook
);
router.get('/format', getMessageFormat);

export default router;
