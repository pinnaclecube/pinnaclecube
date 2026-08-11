import { Router, Request, Response } from 'express';
import type { PinoLogger } from 'pino';

const router = Router();

interface RequestWithLog extends Request {
  log: PinoLogger;
}

router.post('/api/users', async (req: RequestWithLog, res: Response) => {
  try {
    // Database insert logic would go here
    // Example: await db.insert(users).values(req.body);
    
    res.status(201).json({ message: 'User created' });
  } catch (error: any) {
    if (error.code === '23505') {
      // Handle duplicate key constraint violation
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // All other database errors
    req.log.error(error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;