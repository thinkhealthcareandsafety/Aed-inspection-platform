import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './api/middleware/error-handler';
import { authMiddleware } from './api/middleware/auth';

// Routes
import authRouter from './api/routes/auth';
import inspectionRouter from './api/routes/inspections';
import checklistRouter from './api/routes/checklist';
import reportRouter from './api/routes/reports';
import deviceRouter from './api/routes/devices';
import userRouter from './api/routes/users';

export function createApp(): Application {
  const app = express();

  // ── Security ─────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API
    }),
  );

  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }),
  );

  // ── Rate limiting ─────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', limiter);

  // ── Parsing & compression ─────────────────────────────────────────────
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Logging ───────────────────────────────────────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.url === '/health',
    }),
  );

  // ── Health check (unauthenticated) ────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'aed-backend', version: '1.0.0' });
  });

  // ── Uploaded checklist media (photos/videos captured during inspection) ─
  app.use('/uploads', express.static(config.UPLOAD_DIR));

  // ── API routes ────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/inspections', authMiddleware, inspectionRouter);
  app.use('/api/v1/inspections', authMiddleware, checklistRouter);
  app.use('/api/v1/reports', authMiddleware, reportRouter);
  app.use('/api/v1/devices', authMiddleware, deviceRouter);
  app.use('/api/v1/users', authMiddleware, userRouter);

  // ── 404 ───────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // ── Error handler ─────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
