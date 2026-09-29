jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { analyzeChecklistItem, isFeedbackLanguage } from './checklistService';
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
