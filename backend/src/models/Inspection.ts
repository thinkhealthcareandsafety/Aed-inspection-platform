/**
 * Inspection MongoDB model.
 * Stores the complete record of a single AED inspection.
 */
import mongoose, { Document, Schema } from 'mongoose';
import { CHECKLIST_ITEMS } from '../config/checklist-items';

export type InspectionResult = 'PASS' | 'FAIL' | 'REVIEW' | 'INCOMPLETE';
export type InspectionStatusType = 'in_progress' | 'complete' | 'error';
export type ChecklistItemStatus = 'pending' | 'uploaded' | 'analyzing' | 'pass' | 'fail' | 'skipped' | 'error';

export interface IChecklistItemResult {
  itemId: string;
  section: number;
  required: boolean;
  status: ChecklistItemStatus;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  confidence?: number;
  notes?: string;
  aiData?: Record<string, unknown>;
  uploadedAt?: Date;
  analyzedAt?: Date;
}

export interface IInspection extends Document {
  inspectionId: string;
  sessionId: string;
  inspector: mongoose.Types.ObjectId;
  locationId?: string;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
  manufacturer?: string;
  aedModel?: string;
  serialNumber?: string;
  lotNumber?: string;
  udi?: string;
  padsExpiry?: string;
  padsLot?: string;
  batteryExpiry?: string;
  batteryLot?: string;
  batterySerialNumber?: string;
  statusIndicator?: string;
  statusConfidence?: number;
  ledBlinkFrequency?: number;
  inspectionResult: InspectionResult;
  inspectionStatus: InspectionStatusType;
  capturedImages: string[];  // file paths or URLs
  checklist: IChecklistItemResult[];
  notes?: string;
  cvSessionData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistItemSchema = new Schema<IChecklistItemResult>(
  {
    itemId: { type: String, required: true },
    section: { type: Number, required: true },
    required: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'analyzing', 'pass', 'fail', 'skipped', 'error'],
      default: 'pending',
    },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'video'] },
    confidence: { type: Number },
    notes: { type: String },
    aiData: { type: Schema.Types.Mixed },
    uploadedAt: { type: Date },
    analyzedAt: { type: Date },
  },
  { _id: false },
);

function defaultChecklist(): IChecklistItemResult[] {
  return CHECKLIST_ITEMS.map((item) => ({
    itemId: item.id,
    section: item.section,
    required: item.required,
    status: 'pending',
  }));
}

const InspectionSchema = new Schema<IInspection>(
  {
    inspectionId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    inspector: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    locationId: { type: String },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    durationSeconds: { type: Number },
    manufacturer: { type: String },
    aedModel: { type: String },
    serialNumber: { type: String, index: true },
    lotNumber: { type: String },
    udi: { type: String },
    padsExpiry: { type: String },
    padsLot: { type: String },
    batteryExpiry: { type: String },
    batteryLot: { type: String },
    batterySerialNumber: { type: String },
    statusIndicator: { type: String },
    statusConfidence: { type: Number },
    ledBlinkFrequency: { type: Number },
    inspectionResult: {
      type: String,
      enum: ['PASS', 'FAIL', 'REVIEW', 'INCOMPLETE'],
      default: 'INCOMPLETE',
    },
    inspectionStatus: {
      type: String,
      enum: ['in_progress', 'complete', 'error'],
      default: 'in_progress',
    },
    capturedImages: [{ type: String }],
    checklist: { type: [ChecklistItemSchema], default: defaultChecklist },
    notes: { type: String },
    cvSessionData: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound index for dashboard queries
InspectionSchema.index({ inspector: 1, startedAt: -1 });
InspectionSchema.index({ locationId: 1, startedAt: -1 });
InspectionSchema.index({ inspectionResult: 1, startedAt: -1 });

export const Inspection = mongoose.model<IInspection>('Inspection', InspectionSchema);
