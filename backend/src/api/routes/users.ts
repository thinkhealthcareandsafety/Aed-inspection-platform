import { Router, Request, Response, NextFunction } from 'express';
import { User } from '../../models/User';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireRole('admin', 'supervisor'), async (_req, res, next) => {
  try {
    const users = await User.find({}).select('-passwordHash').lean();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

export default router;
