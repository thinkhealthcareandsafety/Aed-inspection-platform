import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../config/env';
import { errorHandler } from '../middleware/error-handler';
import { logger } from '../../utils/logger';
import voiceRouter from './voice';

const MP3 = Buffer.from('ID3-fake-mp3-bytes');

function app() {
  const a = express();
  a.use('/api/v1/voice', voiceRouter);
  a.use(errorHandler);
  return a;
}

let fetchSpy: jest.SpyInstance;
let dir: string;

beforeAll(() => {
  logger.silent = true;
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
  (config as { UPLOAD_DIR: string }).UPLOAD_DIR = dir;
  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(MP3, { status: 200 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/v1/voice/:key.mp3', () => {
  it('records a line once, then serves it from disk', async () => {
    const first = await request(app()).get('/api/v1/voice/5a021524.mp3');
    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toBe('audio/mpeg');
    expect(first.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(first.headers['cache-control']).toContain('immutable');

    const second = await request(app()).get('/api/v1/voice/5a021524.mp3');
    expect(second.status).toBe(200);
    expect(Buffer.from(second.body)).toEqual(MP3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('answers a range request, which Safari needs to play audio', async () => {
    await request(app()).get('/api/v1/voice/5a021524.mp3');
    const res = await request(app()).get('/api/v1/voice/5a021524.mp3').set('Range', 'bytes=0-1');
    expect(res.status).toBe(206);
  });

  it('never asks the AI service for anything that is not a line key', async () => {
    for (const bad of ['..%2F..%2Fetc%2Fpasswd', 'ABCDEF12', 'abc', '5a021524x']) {
      const res = await request(app()).get(`/api/v1/voice/${bad}`);
      expect(res.status).toBe(404);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes on a line the AI service does not have', async () => {
    fetchSpy.mockResolvedValue(new Response('{}', { status: 404 }));
    const res = await request(app()).get('/api/v1/voice/00000000.mp3');
    expect(res.status).toBe(404);
  });

  it('keeps nothing when the AI service fails, so the next tap tries again', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    expect((await request(app()).get('/api/v1/voice/5a021524.mp3')).status).toBe(503);
    expect((await request(app()).get('/api/v1/voice/5a021524.mp3')).status).toBe(200);
  });
});
