/**
 * Someone reached the model picker with an AED the app doesn't support yet
 * and asked for help with it instead of leaving.
 *
 * Before this existed, that visitor was a dead end: they had typed their
 * name, email and phone into the first screen, found no card for their
 * unit, and closed the tab — and because an inspection is only created once
 * a model is chosen, nothing of them was kept. Each record is a named,
 * reachable owner of a specific AED who asked to be contacted about it.
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IModelRequest extends Document {
  name: string;
  email: string;
  phone: string;
  /** The brand they picked, or "Other". */
  brand: string;
  /** Free text, when they know it. (Not `model`: that name is a Document method.) */
  aedModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ModelRequestSchema = new Schema<IModelRequest>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    aedModel: { type: String, trim: true },
  },
  { timestamps: true },
);

// Newest first, and the de-duplication lookup (same person, same brand).
ModelRequestSchema.index({ createdAt: -1 });
ModelRequestSchema.index({ email: 1, brand: 1, createdAt: -1 });

export const ModelRequest = mongoose.model<IModelRequest>('ModelRequest', ModelRequestSchema);
