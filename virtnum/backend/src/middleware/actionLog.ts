import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

export const logAction = (action: string, entity?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      if (res.statusCode < 400) {
        prisma.actionLog
          .create({
            data: {
              userId: req.user?.userId,
              action,
              entity,
              entityId: req.params.id,
              metadata: { body: req.body, query: req.query },
              ip: req.ip,
            },
          })
          .catch((err: Error) => logger.error('Action log error:', err));
      }
      return originalJson(data);
    };
    next();
  };
};
