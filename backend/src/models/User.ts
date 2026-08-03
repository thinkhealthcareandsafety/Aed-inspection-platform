import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export type UserRole = 'inspector' | 'supervisor' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organisationId?: string;
  active: boolean;
  lastLoginAt?: Date;
  comparePassword(password: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['inspector', 'supervisor', 'admin'],
      default: 'inspector',
    },
    organisationId: { type: String, index: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, config.BCRYPT_ROUNDS);
  next();
});

UserSchema.methods.comparePassword = function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Never expose password hash in JSON output
UserSchema.set('toJSON', {
  transform(_doc, ret) {
    delete (ret as any).passwordHash;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);
