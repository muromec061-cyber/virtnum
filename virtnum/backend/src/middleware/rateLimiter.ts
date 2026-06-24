import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export const createRateLimiter = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const endpoint = req.path;
    const now = new Date();
    const resetAt = new Date(now.getTime() + options.windowMs);

    try {
      const existing = await prisma.rateLimit.findUnique({
        where: { ip_endpoint: { ip, endpoint } },
      });

      if (existing) {
        if (existing.resetAt < now) {
          await prisma.rateLimit.update({
            where: { ip_endpoint: { ip, endpoint } },
            data: { count: 1, resetAt },
          });
          return next();
        }

        if (existing.count >= options.max) {
          const retryAfter = Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000);
          res.set('Retry-After', String(retryAfter));
          res.set('X-RateLimit-Limit', String(options.max));
          res.set('X-RateLimit-Remaining', '0');
          return res.status(429).json({
            error: options.message || 'Too many requests, please try again later',
            retryAfter,
          });
        }

        await prisma.rateLimit.update({
          where: { ip_endpoint: { ip, endpoint } },
          data: { count: { increment: 1 } },
        });
      } else {
        await prisma.rateLimit.create({
          data: { ip, endpoint, count: 1, resetAt },
        });
      }

      res.set('X-RateLimit-Limit', String(options.max));
      res.set('X-RateLimit-Remaining', String(options.max - (existing?.count || 0) - 1));
      next();
    } catch (err) {
      logger.error('Rate limiter error:', err);
      next();
    }
  };
};

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again in 15 minutes',
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
});

export const smsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
});
