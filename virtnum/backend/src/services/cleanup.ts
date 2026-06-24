import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

export const startCleanupJob = () => {
  const INTERVAL = 5 * 60 * 1000;

  const cleanup = async () => {
    try {
      const now = new Date();

      const expiredOrders = await prisma.order.findMany({
        where: { status: 'ACTIVE', expiresAt: { lt: now } },
        include: { number: true },
      });

      for (const order of expiredOrders) {
        await prisma.$transaction([
          prisma.order.update({ where: { id: order.id }, data: { status: 'EXPIRED' } }),
          prisma.virtualNumber.update({
            where: { id: order.numberId },
            data: { status: 'AVAILABLE', expiresAt: null },
          }),
          prisma.notification.create({
            data: {
              userId: order.userId,
              title: 'Number Expired',
              message: `Your number ${order.number.number} has expired without receiving SMS.`,
            },
          }),
        ]);
      }

      await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });

      if (expiredOrders.length > 0) {
        logger.info(`Cleaned up ${expiredOrders.length} expired orders`);
      }
    } catch (err) {
      logger.error('Cleanup job error:', err);
    }
  };

  cleanup();
  setInterval(cleanup, INTERVAL);
  logger.info('Cleanup job started');
};
