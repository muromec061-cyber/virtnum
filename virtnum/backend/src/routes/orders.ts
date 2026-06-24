import { Router, Request, Response } from 'express';
import { prisma } from '../prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { logAction } from '../middleware/actionLog';
import { wsManager } from '../websocket/manager';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const where = isAdmin ? {} : { userId: req.user!.userId };

    const orders = await prisma.order.findMany({
      where,
      include: {
        number: { include: { country: true } },
        user: { select: { id: true, email: true, username: true } },
        smsMessages: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, apiRateLimiter, logAction('CREATE_ORDER', 'Order'), async (req: Request, res: Response) => {
  try {
    const { numberId } = req.body;
    if (!numberId) return res.status(400).json({ error: 'numberId is required' });

    const number = await prisma.virtualNumber.findUnique({
      where: { id: numberId },
      include: { country: true },
    });

    if (!number) return res.status(404).json({ error: 'Number not found' });
    if (number.status !== 'AVAILABLE') return res.status(409).json({ error: 'Number is not available' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < number.price) return res.status(402).json({ error: 'Insufficient balance' });

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: {
          userId: req.user!.userId,
          numberId,
          status: 'ACTIVE',
          expiresAt,
        },
        include: {
          number: { include: { country: true } },
        },
      }),
      prisma.virtualNumber.update({
        where: { id: numberId },
        data: { status: 'BUSY', expiresAt },
      }),
      prisma.user.update({
        where: { id: req.user!.userId },
        data: { balance: { decrement: number.price } },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user!.userId,
          type: 'PURCHASE',
          amount: -number.price,
          description: `Purchased number ${number.number}`,
        },
      }),
    ]);

    wsManager.broadcastOrderUpdate(order);
    res.status(201).json(order);
  } catch (err) {
    logger.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        number: { include: { country: true } },
        smsMessages: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/cancel', authenticate, logAction('CANCEL_ORDER', 'Order'), async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { number: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!['PENDING', 'ACTIVE'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled' });
    }

    const refundAmount = order.number.price * 0.5;

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } }),
      prisma.virtualNumber.update({ where: { id: order.numberId }, data: { status: 'AVAILABLE', expiresAt: null } }),
      prisma.user.update({
        where: { id: order.userId },
        data: { balance: { increment: refundAmount } },
      }),
      prisma.transaction.create({
        data: {
          userId: order.userId,
          type: 'REFUND',
          amount: refundAmount,
          description: `Partial refund for cancelled order`,
        },
      }),
    ]);

    res.json({ message: 'Order cancelled', refund: refundAmount });
  } catch (err) {
    logger.error('Cancel order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
