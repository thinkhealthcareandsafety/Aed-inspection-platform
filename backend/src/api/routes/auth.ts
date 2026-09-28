import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { User } from '../../models/User';
import { config } from '../../config/env';
import { createError } from '../middleware/error-handler';
import { authMiddleware } from '../middleware/auth';

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

/**
 * Staff accounts may only be created by an existing admin.
 *
 * This route used to be open to the internet while accepting role:'admin',
 * which meant anyone who found the API hostname — and it is discoverable from
 * the public JS bundle — could mint themselves an admin and read the whole
 * customer pipeline: names, mobile numbers, emails, AED expiry dates.
 *
 * The one exception is a database with no users in it at all. Without that
 * bootstrap there is no way to create the first admin on a fresh deployment
 * short of editing the database by hand.
 */
async function requireAdminUnlessFirstUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userCount = await User.estimatedDocumentCount();
    if (userCount === 0) {
      next();
      return;
    }
    authMiddleware(req, res, () => {
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          error: { message: 'Only an admin can create staff accounts', code: 'FORBIDDEN' },
        });
        return;
      }
      next();
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/register — admin only (see above)
router.post('/register', requireAdminUnlessFirstUser, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * The only thing between the internet and the customer pipeline is a
 * password, and the general API limit allowed ~500 guesses per 15 minutes.
 * Only FAILED attempts count, so a genuine user who signs in normally is
 * never slowed — and twenty wrong tries is well past anyone mistyping.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many failed sign-in attempts. Please wait 15 minutes and try again.',
      code: 'TOO_MANY_ATTEMPTS',
      retryable: false,
    },
  },
});

// POST /api/v1/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
