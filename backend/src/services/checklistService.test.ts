jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { analyzeChecklistItem, deriveResult, isFeedbackLanguage } from './checklistService';
import { logger } from '../utils/logger';

function fakeInspection(aedModel?: string) {
  return {
    inspectionId: 'insp-1',
    aedModel,
    inspectionStatus: 'in_progress',
    inspectionResult: 'INCOMPLETE',
    checklist: [{ itemId: 'serial_number', section: 1, required: true, status: 'pending' }],
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as Parameters<typeof analyzeChecklistItem>[0];
}

const photo = {
  buffer: Buffer.from('fake-jpeg'),
  mimetype: 'image/jpeg',
  originalname: 'serial.jpg',
} as Express.Multer.File;

let fetchSpy: jest.SpyInstance;

beforeAll(() => {
  logger.silent = true;
});

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ passed: true, confidence: 0.9, notes: 'Read.', serial_number: 'X14K718292' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterEach(() => fetchSpy.mockRestore());

function sentForm(): FormData {
  return fetchSpy.mock.calls[0][1].body as FormData;
}

describe('analyzeChecklistItem → AI service', () => {
  it('tells the AI service which AED is in the photo, and the inspector’s language', async () => {
    await analyzeChecklistItem(fakeInspection('Zoll AED Plus'), 'serial_number', photo, { lang: 'hi' });

    const form = sentForm();
    expect(form.get('aed_model')).toBe('Zoll AED Plus');
    expect(form.get('lang')).toBe('hi');
    expect(form.get('file')).toBeTruthy();
  });

  it('sends neither when there is no model or language to send', async () => {
    await analyzeChecklistItem(fakeInspection(undefined), 'serial_number', photo);

    const form = sentForm();
    expect(form.get('aed_model')).toBeNull();
    expect(form.get('lang')).toBeNull();
  });
});

describe('isFeedbackLanguage', () => {
  it('accepts only the languages the AI can write feedback in', () => {
    expect(isFeedbackLanguage('hi')).toBe(true);
    for (const value of ['en', 'HI', '', undefined, null, 42, 'fr']) {
      expect(isFeedbackLanguage(value)).toBe(false);
    }
  });
});

describe('deriveResult — the readiness score', () => {
  const ALL = ['serial_number', 'pads_expiry', 'battery_expiry', 'battery_attached', 'pads_connected', 'readiness_indicator'];
  const checks = (status: Record<string, string> = {}) =>
    ALL.map((itemId) => ({ itemId, section: 1, required: true, status: status[itemId] ?? 'pass' })) as Parameters<
      typeof deriveResult
    >[0];

  it('passes an AED whose every required check passes (90 of 100)', () => {
    expect(deriveResult(checks())).toBe('PASS');
  });

  it('fails expired pads: 70, below 80', () => {
    expect(deriveResult(checks({ pads_expiry: 'fail' }))).toBe('FAIL');
  });

  it('fails unplugged pads even though the score, 85, is above 80', () => {
    expect(deriveResult(checks({ pads_connected: 'fail' }))).toBe('FAIL');
  });

  it('does not fail the AED over a serial number it could not read: 80', () => {
    expect(deriveResult(checks({ serial_number: 'fail' }))).toBe('PASS');
  });

  it('waits for checks still in progress', () => {
    expect(deriveResult(checks({ battery_attached: 'pending' }))).toBe('REVIEW');
  });
});

describe('readinessScore', () => {
  it('adds the marks of the checks that passed, out of 100', () => {
    const { readinessScore } = jest.requireActual('../config/scoring');
    expect(
      readinessScore([
        { itemId: 'pads_expiry', status: 'pass' },
        { itemId: 'readiness_indicator', status: 'pass' },
        { itemId: 'battery_expiry', status: 'fail' },
        { itemId: 'aed_cabinet', status: 'pass' },
        { itemId: 'child_key_pad', status: 'skipped' },
      ]),
    ).toBe(53);
  });
});

describe('deriveResult — the quick check', () => {
  const quick = (readiness: string, serial = 'pass') =>
    [
      { itemId: 'readiness_indicator', section: 1, required: true, status: readiness },
      { itemId: 'serial_number', section: 1, required: true, status: serial },
      { itemId: 'pads_expiry', section: 2, required: true, status: 'pending' },
      { itemId: 'battery_expiry', section: 2, required: true, status: 'pending' },
    ] as Parameters<typeof deriveResult>[0];

  it('passes an AED whose readiness indicator shows ready, with the rest not checked', () => {
    expect(deriveResult(quick('pass'), 'quick')).toBe('PASS');
  });

  it('fails an AED whose readiness indicator does not show ready', () => {
    expect(deriveResult(quick('fail'), 'quick')).toBe('FAIL');
  });

  it('does not fail a ready AED over a serial number it could not read', () => {
    expect(deriveResult(quick('pass', 'fail'), 'quick')).toBe('PASS');
  });

  it('judges the same checklist as a full inspection by every check', () => {
    expect(deriveResult(quick('pass'), 'full')).toBe('REVIEW');
  });
});
