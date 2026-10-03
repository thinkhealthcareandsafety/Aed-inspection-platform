/**
 * GET /api/v1/voice/:key.mp3 — a check's instructions, spoken.
 *
 * The AI service records a line (python-cv app/services/voice_service.py,
 * which speaks only the app's own instruction lines) the first time it is
 * asked for; this keeps the recording on the server's disk, so each line is
 * made once and is a plain static file from then on. Served with Range
 * support, which Safari needs before it will play audio at all.
 */
import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/env';
import { createError } from '../middleware/error-handler';
import { logger } from '../../utils/logger';

const router = Router();

const KEY = /^[0-9a-f]{8}$/;
const RECORDING_TIMEOUT_MS = 60_000;

/** Bumped when recordings must all be made again (as when every line ended
 *  in a crackle: the model's WAV signature, played as sound). Each set of
 *  recordings lives in its own folder; the page asks for this one by
 *  RECORDING in ListenButton, so browsers fetch the new ones too. */
const RECORDING = 'r2';

function voiceDir(): string {
  return path.join(config.UPLOAD_DIR, 'voice', RECORDING);
}

/** Two taps on a line not yet recorded make one recording, not two. */
const inFlight = new Map<string, Promise<boolean>>();

/** Ensures the line is on disk; false if it isn't one of the app's lines. */
async function ensureRecorded(key: string, file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    // Not recorded yet.
  }
  let pending = inFlight.get(key);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(`${config.CV_SERVICE_URL}/api/v1/voice/${key}`, {
        signal: AbortSignal.timeout(RECORDING_TIMEOUT_MS),
      });
      if (res.status === 404) return false;
      if (!res.ok) throw createError('Voice unavailable', 503, 'VOICE_UNAVAILABLE');
      const mp3 = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(voiceDir(), { recursive: true });
      // Written whole, then renamed: a half-written file is never served.
      const partial = `${file}.${process.pid}.part`;
      await fs.writeFile(partial, mp3);
      await fs.rename(partial, file);
      logger.info('voice.recorded', { key, bytes: mp3.length });
      return true;
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

router.get('/:file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = String(req.params.file).replace(/\.mp3$/, '');
    if (!KEY.test(key)) throw createError('No such line', 404, 'NOT_FOUND');
    const file = path.join(voiceDir(), `${key}.mp3`);
    if (!(await ensureRecorded(key, file))) throw createError('No such line', 404, 'NOT_FOUND');
    res.sendFile(file, {
      maxAge: '365d',
      immutable: true, // the key is a hash of the words: new words, new key
      headers: {
        'Content-Type': 'audio/mpeg',
        // Played by the page on inspector.aedsmartx.com, another origin.
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
