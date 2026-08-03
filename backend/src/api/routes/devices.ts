import { Router } from 'express';
const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'Device registry — coming soon', data: [] });
});

export default router;
