import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../../models/User';
import { config } from '../../config/env';
import { createError } from '../middleware/error-handler';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['inspector', 'supervisor', 'admin']).default('inspector'),
  organisationId: z.string().optional(),
});

function signToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);
    const exists = await User.findOne({ email: body.email });
    if (exists) throw createError('Email already registered', 409, 'EMAIL_EXISTS');

    const user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash: body.password,
      role: body.role,
      organisationId: body.organisationId,
    });

    const token = signToken(String(user._id), user.email, user.role);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: body.email, active: true });
    if (!user) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const valid = await user.comparePassword(body.password);
    if (!valid) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(String(user._id), user.email, user.role);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
import { authMiddleware } from '../middleware/auth';
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash');
    if (!user) throw createError('User not found', 404, 'NOT_FOUND');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
