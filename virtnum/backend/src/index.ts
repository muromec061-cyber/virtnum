import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { wsManager } from './websocket/manager';
import { startCleanupJob } from './services/cleanup';
import { logger } from './utils/logger';

import authRoutes from './routes/auth';
import numbersRoutes from './routes/numbers';
import ordersRoutes from './routes/orders';
import smsRoutes from './routes/sms';
import usersRoutes from './routes/users';
import adminRoutes from './routes/admin';
import countriesRoutes from './routes/countries';

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ws_clients: wsManager.getConnectedCount(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/numbers', numbersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/countries', countriesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

wsManager.initialize(httpServer);
startCleanupJob();

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
