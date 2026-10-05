import express from 'express';
import request from 'supertest';
import { AnalyticsEvent } from '../../models/AnalyticsEvent';
import { logger } from '../../utils/logger';
import eventsRouter from './events';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/v1/events', eventsRouter);
  return a;
}

const base = { visitorId: 'visitor-12345', sessionId: 'session-12345' };

let insertSpy: jest.SpyInstance;

beforeAll(() => {
  logger.silent = true;
});

beforeEach(() => {
  insertSpy = jest.spyOn(AnalyticsEvent, 'insertMany').mockResolvedValue([] as never);
});

afterEach(() => {
  insertSpy.mockRestore();
});

describe('POST /api/v1/events', () => {
  it('keeps the funnel steps when one event in the batch is unknown', async () => {
    const res = await request(app())
      .post('/api/v1/events')
      .send({
        events: [
          { ...base, event: 'contact_submitted' },
          { ...base, event: 'not_an_event_yet' },
          { ...base, event: 'path_chosen', outcome: 'full' },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(2);
    const stored = insertSpy.mock.calls[0][0] as Array<{ event: string }>;
    expect(stored.map((e) => e.event)).toEqual(['contact_submitted', 'path_chosen']);
  });

  it('stores nothing when no event in the batch is valid', async () => {
    const res = await request(app())
      .post('/api/v1/events')
      .send({ events: [{ ...base, event: 'not_an_event_yet' }] });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
