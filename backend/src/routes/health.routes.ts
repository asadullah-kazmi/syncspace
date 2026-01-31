import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'SyncSpace API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
