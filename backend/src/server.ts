/**
 * AED Inspection Platform — Express + Socket.IO Server
 */
import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { createSocketServer } from './websocket/socket-server';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { config } from './config/env';

async function bootstrap() {
  try {
    // Database connection
    await connectDatabase();
    logger.info('Database connected');

    // Express app
    const app = createApp();
    const httpServer = http.createServer(app);

    // Socket.IO
    createSocketServer(httpServer);

    httpServer.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`, {
        env: config.NODE_ENV,
        port: config.PORT,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down`);
      httpServer.close(() => process.exit(0));
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Bootstrap failed', { error });
    process.exit(1);
  }
}

bootstrap();
