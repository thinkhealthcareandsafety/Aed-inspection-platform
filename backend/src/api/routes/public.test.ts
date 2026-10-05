import express from 'express';
import request from 'supertest';

jest.mock('../../services/emailService', () => ({
  sendInspectionReportEmail: jest.fn(),
  sendReplacementRequestEmail: jest.fn().mockResolvedValue({ sent: true }),
  sendModelRequestEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

jest.mock('../../services/reportService', () => ({
  ...jest.requireActual('../../services/reportService'),
  generateInspectionPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF')),
}));

jest.mock('../../models/Inspection', () => ({
  ...jest.requireActual('../../models/Inspection'),
  Inspection: { findOne: jest.fn() },
}));

jest.mock('../../models/ModelRequest', () => ({
  ModelRequest: { findOne: jest.fn(), create: jest.fn() },
}));

import publicRouter from './public';
import { errorHandler } from '../middleware/error-handler';
import { Inspection } from '../../models/Inspection';
import { ModelRequest } from '../../models/ModelRequest';
import { sendInspectionReportEmail, sendModelRequestEmail, sendReplacementRequestEmail } from '../../services/emailService';
import { logger } from '../../utils/logger';

const findOne = Inspection.findOne as jest.Mock;
const notifySales = sendReplacementRequestEmail as jest.Mock;
const findRequest = ModelRequest.findOne as jest.Mock;
const createRequest = ModelRequest.create as jest.Mock;
const notifyModelRequest = sendModelRequestEmail as jest.Mock;

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
  findRequest.mockReset();
  createRequest.mockReset();
  notifyModelRequest.mockClear();
});

describe('POST /public/model-requests', () => {
  const body = {
    name: 'Priya Sharma',
    email: 'Priya@Acme.in',
    phone: '+919876543210',
    brand: 'Mindray',
    model: 'BeneHeart C1A',
  };

  it('keeps the visitor as a lead and tells the sales team', async () => {
    findRequest.mockResolvedValue(null);
    createRequest.mockImplementation(async (doc) => ({ ...doc, createdAt: new Date() }));

    const res = await request(makeApp()).post('/api/v1/public/model-requests').send(body);

    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({ brand: 'Mindray', model: 'BeneHeart C1A' });
    // Stored lower-cased, so the de-duplication below matches however it was typed.
    expect(createRequest.mock.calls[0][0]).toMatchObject({ email: 'priya@acme.in', brand: 'Mindray', aedModel: 'BeneHeart C1A' });
    expect(notifyModelRequest).toHaveBeenCalledTimes(1);
  });

  it('answers a repeat within a day without emailing again', async () => {
    findRequest.mockResolvedValue({ brand: 'Mindray', aedModel: 'BeneHeart C1A', createdAt: new Date() });

    const res = await request(makeApp()).post('/api/v1/public/model-requests').send(body);

    expect(res.status).toBe(200);
    expect(createRequest).not.toHaveBeenCalled();
    expect(notifyModelRequest).not.toHaveBeenCalled();
  });

  it('refuses a request without contact details or a brand', async () => {
    for (const bad of [{ ...body, brand: '' }, { ...body, email: 'not-an-email' }, { brand: 'Mindray' }]) {
      const res = await request(makeApp()).post('/api/v1/public/model-requests').send(bad);
      expect(res.status).toBe(400);
    }
    expect(createRequest).not.toHaveBeenCalled();
    expect(notifyModelRequest).not.toHaveBeenCalled();
  });
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

describe('POST /public/inspections/:id/complete — the quick check', () => {
  const checklist = (readiness: string, serial: string) => [
    { itemId: 'readiness_indicator', section: 1, required: true, status: readiness },
    { itemId: 'serial_number', section: 1, required: true, status: serial, aiData: { serial_number: 'B17C-00514' } },
    { itemId: 'pads_expiry', section: 2, required: true, status: 'pending' },
  ];
  const complete = () => request(makeApp()).post('/api/v1/public/inspections/insp-1/complete');
  beforeEach(() => {
    (sendInspectionReportEmail as jest.Mock).mockResolvedValue({ sent: true, recipients: ['priya@acme.in'] });
  });

  it('issues a quick-check report once the readiness indicator and serial are answered', async () => {
    const inspection = fakeInspection({ inspectionStatus: 'in_progress', checklist: checklist('pass', 'pass'), startedAt: new Date() });
    findOne.mockResolvedValue({ ...inspection, toObject: () => inspection });
    const res = await complete().send({ scope: 'quick' });
    expect(res.status).toBe(200);
    expect(res.body.inspection.scope).toBe('quick');
    expect(res.body.inspection.inspectionResult).toBe('PASS');
  });

  it('refuses a quick-check report before the serial number is answered', async () => {
    findOne.mockResolvedValue(fakeInspection({ inspectionStatus: 'in_progress', checklist: checklist('pass', 'pending') }));
    const res = await complete().send({ scope: 'quick' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QUICK_CHECK_INCOMPLETE');
  });

  it('treats a finish that names no scope as a full inspection', async () => {
    const inspection = fakeInspection({ inspectionStatus: 'in_progress', checklist: checklist('pass', 'pass'), startedAt: new Date() });
    findOne.mockResolvedValue({ ...inspection, toObject: () => inspection });
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body.inspection.scope).toBe('full');
  });
});
