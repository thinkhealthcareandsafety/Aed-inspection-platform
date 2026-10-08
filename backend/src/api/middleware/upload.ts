/**
 * The one way a checklist photo or video comes in, for both the staff and the
 * public routes.
 *
 * Uploads go to a temporary file, not memory. A phone's own camera makes
 * 30-150 MB of video for a 15-second clip; held in memory, two of those at
 * once would take the server down. The AI service shrinks every clip before
 * it is analysed, so the only cost of a big file is the time it takes to
 * arrive. The temporary file is removed once the response has gone out.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { config } from '../../config/env';
import { createError } from './error-handler';

const TMP_DIR = path.join(os.tmpdir(), 'aed-uploads');

const multerUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(TMP_DIR, { recursive: true }, (err) => cb(err, TMP_DIR));
    },
    // Never the uploaded filename: it is the caller's to choose.
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
});

/** `upload.single(field)`, with an over-size file said as what it is and the
 *  temporary copy always cleaned up. */
export function singleMediaUpload(field: string): RequestHandler {
  const handler = multerUpload.single(field);
  return (req: Request, res: Response, next: NextFunction) => {
    const cleanup = () => {
      const tmp = req.file?.path;
      if (tmp) fs.unlink(tmp, () => undefined);
    };
    res.once('finish', cleanup);
    res.once('close', cleanup);
    handler(req, res, (err?: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        next(
          createError(
            `This file is larger than ${config.MAX_FILE_SIZE_MB} MB. Please record a shorter video (about 10 seconds).`,
            413,
            'FILE_TOO_LARGE',
          ),
        );
        return;
      }
      if (err instanceof multer.MulterError) {
        next(createError('Please upload one photo or video.', 400, 'BAD_UPLOAD'));
        return;
      }
      next(err as Error | undefined);
    });
  };
}
