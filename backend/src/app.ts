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
import publicRouter from './api/routes/public';
import eventsRouter from './api/routes/events';
import insightsRouter from './api/routes/insights';
import voiceRouter from './api/routes/voice';

export function createApp(): Application {
  const app = express();

  // Render terminates the connection at its load balancer, so without this
  // every request appears to come from the balancer's address. The rate
  // limiters below key on client IP — they were effectively one shared bucket
  // for the entire world: ~120 requests per 15 minutes across every user at
  // once, about fourteen inspections, before everyone was refused.
  // Exactly one hop, not `true`: trusting every X-Forwarded-For entry would
  // let a client pick its own IP and walk straight past the limits.
  app.set('trust proxy', 1);

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
    // Public inspection traffic and telemetry each have their own limiter,
    // sized for them. Counting them here as well double-limited the public
    // flow, so the smaller general budget was the one that actually bit.
    skip: (req) =>
      req.originalUrl.startsWith('/api/v1/public') || req.originalUrl.startsWith('/api/v1/events'),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', limiter);

  // Public (unauthenticated) inspection flow gets its own, tighter limit —
  // it's open to anyone on the internet, unlike the staff API above.
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.PUBLIC_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/v1/public', publicLimiter);

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
  // The frontend runs on a different origin (inspector.aedsmartx.com) from
  // this API, and helmet's default Cross-Origin-Resource-Policy of
  // same-origin made browsers refuse to render every uploaded photo —
  // net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin, a broken image where the
  // inspector's own capture should be. These files are unguessable
  // (two UUIDs in the path), so cross-origin is the right policy here.
  //
  // The CSP is defence in depth: were anything other than an image or video
  // ever to land in this directory, it is served sandboxed with no ability
  // to run script, rather than as a live page on our domain.
  app.use(
    '/uploads',
    express.static(config.UPLOAD_DIR, {
      setHeaders(res) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    }),
  );

  // ── API routes ────────────────────────────────────────────────────────
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/events', eventsRouter);
  app.use('/api/v1/voice', voiceRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/inspections', authMiddleware, inspectionRouter);
  app.use('/api/v1/inspections', authMiddleware, checklistRouter);
  app.use('/api/v1/reports', authMiddleware, reportRouter);
  app.use('/api/v1/devices', authMiddleware, deviceRouter);
  app.use('/api/v1/users', authMiddleware, userRouter);
  app.use('/api/v1/insights', authMiddleware, insightsRouter);

  // ── 404 ───────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // ── Error handler ─────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
