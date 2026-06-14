import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import campRoutes from './routes/campRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import clientMasterRoutes from './routes/clientMasterRoutes.js';
import importRoutes from './routes/importRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { trimRequest } from './middleware/trimRequest.js';
import { startEmailPoller } from './services/emailPoller.js';
import { ensureServiceUsers } from './services/ensureServiceUsers.js';
import { ensureCampIndexes } from './services/ensureCampIndexes.js';
import { ensureProgramDocumentsDir } from './utils/programDocumentStorage.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));

app.use('/api/ingest/whatsapp', whatsappRoutes);
app.use('/api/ingest/email', emailRoutes);

app.use(express.json({ limit: '2mb' }));
app.use(trimRequest);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'k-dashboard-server' });
});

app.use('/api/auth', authRoutes);
app.use('/api/camps', campRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/client-masters', clientMasterRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/k_dashboard';
  await connectDB(uri);
  await ensureCampIndexes();
  await ensureProgramDocumentsDir();
  await ensureServiceUsers();
  await startEmailPoller();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
