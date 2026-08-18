// ── Checklist types (10-item, 3-section inspection flow) ───────────────────────

export type ChecklistItemId =
  | 'serial_number'
  | 'pads_expiry'
  | 'battery_expiry'
  | 'battery_attached'
  | 'pads_connected'
  | 'readiness_indicator'
  | 'child_key_pad'
  | 'aed_cabinet'
  | 'first_response_kit'
  | 'emergency_contacts';

export type ChecklistMediaType = 'image' | 'video';

export type ChecklistItemStatus =
  | 'pending'
  | 'uploaded'
  | 'analyzing'
  | 'pass'
  | 'fail'
  | 'skipped'
  | 'error';

export interface ChecklistAiData {
  passed: boolean;
  confidence: number;
  notes: string;
  serial_number?: string | null;
  expiry_date?: string | null;
  expiry_raw_text?: string | null;
  lot_number?: string | null;
  battery_serial_number?: string | null;
  present?: boolean | null;
  status?: string | null;
}

export interface ChecklistItemResult {
  itemId: ChecklistItemId;
  section: 1 | 2 | 3;
  required: boolean;
  status: ChecklistItemStatus;
  mediaUrl?: string;
  mediaType?: ChecklistMediaType;
  confidence?: number;
  notes?: string;
  aiData?: ChecklistAiData;
  uploadedAt?: string;
  analyzedAt?: string;
}

// ── Inspection types ──────────────────────────────────────────────────────────

export type InspectionStep =
  | 'wait_for_machine'
  | 'identify_machine'
  | 'serial_number'
  | 'pads_expiry'
  | 'battery_check'
  | 'status_check'
  | 'report'
  | 'complete';

export type InspectionStatus = 'waiting' | 'in_progress' | 'complete' | 'error' | 'paused';

export type InspectionResult = 'PASS' | 'FAIL' | 'REVIEW' | 'INCOMPLETE';

export interface Detection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // x1, y1, x2, y2
}

export interface FrameQuality {
  blur: number;
  brightness: number;
  acceptable: boolean;
}

export interface StateUpdate {
  type: 'state_update' | 'inspection_complete' | 'session_ready' | 'error' | 'cv_error' | 'cv_disconnected' | 'keepalive';
  session_id?: string;
  frame_number?: number;
  timestamp?: number;
  step?: InspectionStep;
  progress?: number;
  instruction?: string;
  completed?: boolean;
  status?: InspectionStatus;
  data?: Record<string, unknown>;
  guidance?: { arrow?: string; hint?: string };
  error?: string;
  detections?: Detection[];
  frame_quality?: FrameQuality;
  message?: string;
}

export interface InspectionSession {
  inspectionId: string;
  sessionId: string;
  step: InspectionStep;
  progress: number;
  instruction: string;
  status: InspectionStatus;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  padsExpiry?: string;
  batteryExpiry?: string;
  statusIndicator?: string;
  inspectionResult?: InspectionResult;
  detections: Detection[];
  frameQuality?: FrameQuality;
  guidance?: { arrow?: string; hint?: string };
  completedData?: Record<string, unknown>;
  error?: string;
}

// ── API types ─────────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'inspector' | 'supervisor' | 'admin';
  organisationId?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Inspection {
  _id: string;
  inspectionId: string;
  sessionId: string;
  inspector: { _id: string; name: string; email: string };
  locationId?: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  padsExpiry?: string;
  batteryExpiry?: string;
  statusIndicator?: string;
  statusConfidence?: number;
  batteryLot?: string;
  batterySerialNumber?: string;
  inspectionResult: InspectionResult;
  inspectionStatus: 'in_progress' | 'complete' | 'error';
  capturedImages: string[];
  checklist: ChecklistItemResult[];
  notes?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface InspectionStats {
  total: number;
  passed: number;
  failed: number;
  review: number;
  recent: number;
  passRate: number;
}

// ── Step metadata ─────────────────────────────────────────────────────────────

export const STEP_META: Record<InspectionStep, { label: string; icon: string; order: number }> = {
  wait_for_machine:  { label: 'Detect AED',       icon: '📷', order: 0 },
  identify_machine:  { label: 'Identify Model',    icon: '🔍', order: 1 },
  serial_number:     { label: 'Serial Number',     icon: '🏷️', order: 2 },
  pads_expiry:       { label: 'Pads Expiry',       icon: '⚡', order: 3 },
  battery_check:     { label: 'Battery',           icon: '🔋', order: 4 },
  status_check:      { label: 'Status Indicator',  icon: '🟢', order: 5 },
  report:            { label: 'Generate Report',   icon: '📋', order: 6 },
  complete:          { label: 'Complete',          icon: '✅', order: 7 },
};
