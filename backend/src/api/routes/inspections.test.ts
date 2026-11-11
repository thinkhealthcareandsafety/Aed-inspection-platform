import fs from 'fs';
import os from 'os';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { config } from '../../config/env';
import { Inspection } from '../../models/Inspection';
import { AnalyticsEvent } from '../../models/AnalyticsEvent';
import { logger } from '../../utils/logger';
import { errorHandler } from '../middleware/error-handler';
import inspectionRouter from './inspections';
import insightsRouter from './insights';

const ID_A = '11111111-2222-4333-8444-555555555555';
const ID_B = '66666666-7777-4888-8999-aaaaaaaaaaaa';

/** The real auth middleware checks a JWT; here the role comes from a header. */
function app() {
  const a = express();
  a.use(express.json());
  a.use((req: Request, _res: Response, next: NextFunction) => {
    const role = req.header('x-test-role');
    if (role) req.user = { userId: 'u1', email: 'admin@example.com', role };
    next();
  });
  a.use('/api/v1/inspections', inspectionRouter);
  a.use('/api/v1/insights', insightsRouter);
  a.use(errorHandler);
  return a;
}

let uploads: string;
let originalUploadDir: string;
let findSpy: jest.SpyInstance;
let deleteSpy: jest.SpyInstance;
let eventsDeleteSpy: jest.SpyInstance;

function stored(...ids: string[]) {
  findSpy.mockReturnValue({ lean: () => Promise.resolve(ids.map((inspectionId) => ({ inspectionId }))) } as never);
  deleteSpy.mockResolvedValue({ deletedCount: ids.length } as never);
}

function makeFolder(id: string) {
  fs.mkdirSync(path.join(uploads, id), { recursive: true });
  fs.writeFileSync(path.join(uploads, id, 'serial_number_x.jpg'), 'photo');
}

beforeAll(() => {
  logger.silent = true;
  originalUploadDir = config.UPLOAD_DIR;
});

beforeEach(() => {
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'aed-uploads-'));
  (config as { UPLOAD_DIR: string }).UPLOAD_DIR = uploads;
  findSpy = jest.spyOn(Inspection, 'find');
  deleteSpy = jest.spyOn(Inspection, 'deleteMany');
  eventsDeleteSpy = jest.spyOn(AnalyticsEvent, 'deleteMany').mockResolvedValue({ deletedCount: 3 } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(uploads, { recursive: true, force: true });
  (config as { UPLOAD_DIR: string }).UPLOAD_DIR = originalUploadDir;
});

describe('DELETE /api/v1/inspections/:id', () => {
  it('lets an admin delete an inspection, its photos and its events, and nothing else', async () => {
    stored(ID_A);
    makeFolder(ID_A);
    makeFolder(ID_B);

    const res = await request(app()).delete(`/api/v1/inspections/${ID_A}`).set('x-test-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(1);
    expect(deleteSpy).toHaveBeenCalledWith({ inspectionId: { $in: [ID_A] } });
    expect(eventsDeleteSpy).toHaveBeenCalledWith({ inspectionId: { $in: [ID_A] } });
    expect(fs.existsSync(path.join(uploads, ID_A))).toBe(false);
    expect(fs.existsSync(path.join(uploads, ID_B))).toBe(true);
  });

  it.each(['inspector', 'supervisor'])('refuses a %s', async (role) => {
    stored(ID_A);
    makeFolder(ID_A);

    const res = await request(app()).delete(`/api/v1/inspections/${ID_A}`).set('x-test-role', role);

    expect(res.status).toBe(403);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploads, ID_A))).toBe(true);
  });

  it('says not found for an inspection that is already gone', async () => {
    stored();
    const res = await request(app()).delete(`/api/v1/inspections/${ID_A}`).set('x-test-role', 'admin');
    expect(res.status).toBe(404);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('never lets an id reach outside the uploads folder', async () => {
    fs.writeFileSync(path.join(uploads, 'keep.txt'), 'x');
    const res = await request(app())
      .delete(`/api/v1/inspections/${encodeURIComponent('..')}`)
      .set('x-test-role', 'admin');
    expect(res.status).toBe(404);
    expect(findSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploads, 'keep.txt'))).toBe(true);
  });
});

describe('POST /api/v1/inspections/bulk-delete', () => {
  it('deletes the existing inspections among those picked', async () => {
    stored(ID_A, ID_B);
    makeFolder(ID_A);
    makeFolder(ID_B);

    const res = await request(app())
      .post('/api/v1/inspections/bulk-delete')
      .set('x-test-role', 'admin')
      .send({ ids: [ID_A, ID_B, ID_A, 'not-an-id'] });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
    expect(findSpy.mock.calls[0][0]).toEqual({ inspectionId: { $in: [ID_A, ID_B] } });
    expect(fs.existsSync(path.join(uploads, ID_A))).toBe(false);
    expect(fs.existsSync(path.join(uploads, ID_B))).toBe(false);
  });

  it('rejects an empty selection', async () => {
    const res = await request(app())
      .post('/api/v1/inspections/bulk-delete')
      .set('x-test-role', 'admin')
      .send({ ids: [] });
    expect(res.status).toBe(400);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('refuses anyone but an admin', async () => {
    const res = await request(app())
      .post('/api/v1/inspections/bulk-delete')
      .set('x-test-role', 'inspector')
      .send({ ids: [ID_A] });
    expect(res.status).toBe(403);
    expect(findSpy).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/insights/events', () => {
  it('lets an admin clear the funnel stats', async () => {
    const res = await request(app()).delete('/api/v1/insights/events').set('x-test-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(3);
    expect(eventsDeleteSpy).toHaveBeenCalledWith({});
  });

  it('refuses anyone but an admin', async () => {
    const res = await request(app()).delete('/api/v1/insights/events').set('x-test-role', 'supervisor');
    expect(res.status).toBe(403);
    expect(eventsDeleteSpy).not.toHaveBeenCalled();
  });
});
