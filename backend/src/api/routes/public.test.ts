import express from 'express';
import request from 'supertest';

jest.mock('../../services/emailService', () => ({
  sendInspectionReportEmail: jest.fn(),
  sendReplacementRequestEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

jest.mock('../../models/Inspection', () => ({
  ...jest.requireActual('../../models/Inspection'),
  Inspection: { findOne: jest.fn() },
}));

import publicRouter from './public';
import { errorHandler } from '../middleware/error-handler';
import { Inspection } from '../../models/Inspection';
import { sendReplacementRequestEmail } from '../../services/emailService';
import { logger } from '../../utils/logger';

const findOne = Inspection.findOne as jest.Mock;
const notifySales = sendReplacementRequestEmail as jest.Mock;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/public', publicRouter);
  app.use(errorHandler);
  return app;
}

function fakeInspection(overrides: Record<string, unknown> = {}) {
  return {
    inspectionId: 'insp-1',
    aedModel: 'Philips FRx',
    serialNumber: 'B17C-00514',
    padsExpiry: '2026-03',
    inspectionResult: 'FAIL',
    guestName: 'Priya Sharma',
    guestEmail: 'priya@acme.in',
    guestPhone: '+919876543210',
    replacementRequest: undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const endpoint = (id = 'insp-1') => `/api/v1/public/inspections/${id}/replacement-request`;

beforeAll(() => {
  logger.silent = true;
});

beforeEach(() => {
  findOne.mockReset();
  notifySales.mockClear();
});

describe('POST /public/inspections/:id/replacement-request', () => {
  it('records the request and tells the sales team', async () => {
    const doc = fakeInspection();
    findOne.mockResolvedValue(doc);

    const res = await request(makeApp()).post(endpoint()).send({ items: ['pads', 'pads'] });

    expect(res.status).toBe(201);
    expect(res.body.replacementRequest.items).toEqual(['pads']);
    expect(res.body.replacementRequest.requestedAt).toBeDefined();
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(notifySales).toHaveBeenCalledTimes(1);
    expect(notifySales.mock.calls[0][0]).toMatchObject({
      inspectionId: 'insp-1',
      items: ['pads'],
      guestPhone: '+919876543210',
      padsExpiry: '2026-03',
    });
  });

  it('answers a repeat with the original request and never emails twice', async () => {
    // A double tap, a retry or a script must not flood the sales inbox.
    const requestedAt = new Date('2026-09-01T10:00:00Z');
    const doc = fakeInspection({ replacementRequest: { items: ['battery'], requestedAt } });
    findOne.mockResolvedValue(doc);

    const res = await request(makeApp()).post(endpoint()).send({ items: ['pads'] });

    expect(res.status).toBe(200);
    expect(res.body.replacementRequest.items).toEqual(['battery']);
    expect(doc.save).not.toHaveBeenCalled();
    expect(notifySales).not.toHaveBeenCalled();
  });

  it('refuses anything that is not a known replacement item', async () => {
    findOne.mockResolvedValue(fakeInspection());

    for (const body of [{ items: ['defibrillator'] }, { items: [] }, {}]) {
      const res = await request(makeApp()).post(endpoint()).send(body);
      expect(res.status).toBe(400);
    }
    expect(notifySales).not.toHaveBeenCalled();
  });

  it('404s for an inspection that does not exist', async () => {
    findOne.mockResolvedValue(null);

    const res = await request(makeApp()).post(endpoint('nope')).send({ items: ['pads'] });

    expect(res.status).toBe(404);
    expect(notifySales).not.toHaveBeenCalled();
  });
});
