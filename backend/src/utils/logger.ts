import winston from 'winston';
import { config } from '../config/env';

const { combine, timestamp, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format:
    config.NODE_ENV === 'production'
      ? combine(timestamp(), json())
      : combine(colorize(), simple()),
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});
