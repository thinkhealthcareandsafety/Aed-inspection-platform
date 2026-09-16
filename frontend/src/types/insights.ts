export interface FunnelStepRow {
  key: string;
  label: string;
  sessions: number;
  /** People who reached the previous step and never reached this one. */
  lost: number;
  fromPrev: number;
  fromTop: number;
}

export interface FunnelResponse {
  range: { days: number; from: string; to: string };
  steps: FunnelStepRow[];
  /** Index into `steps` of the costliest drop-off, or -1 when there is none. */
  biggestDropIndex: number;
  totals: {
    started: number;
    completed: number;
    completionRate: number;
    medianMinutes: number | null;
  };
  byModel: { model: string; started: number; completed: number; rate: number }[];
  daily: { date: string; started: number; completed: number }[];
  devices: { device: string; sessions: number }[];
  itemFriction: {
    itemId: string;
    analyzed: number;
    failed: number;
    errored: number;
    failRate: number;
  }[];
}

export type ExpiryUrgency = 'expired' | 'critical' | 'soon' | 'ok';

export interface PipelineRow {
  inspectionId: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  aedModel?: string;
  serialNumber?: string;
  padsExpiry?: string;
  padsExpiryAt?: string;
  batteryExpiry?: string;
  batteryExpiryAt?: string;
  nextExpiryAt: string;
  nextExpiryKind: 'pads' | 'battery';
  daysRemaining: number;
  urgency: ExpiryUrgency;
  lastInspectedAt: string;
  inspectionResult: string;
}

export interface PipelineResponse {
  summary: {
    total: number;
    expired: number;
    critical: number;
    soon: number;
    ok: number;
    contactable: number;
  };
  rows: PipelineRow[];
}
