import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logger } from '../utils/logger';

const router = Router();

router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        balance: true,
        isVerified: true,
        createdAt: true,
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/balance', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { balance: true },
    });
    res.json({ balance: user?.balance || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.transaction.count({ where: { userId: req.user!.userId } }),
    ]);

    res.json({
      data: transactions,
      pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/notifications/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/favorites', authenticate, async (req: Request, res: Response) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user!.userId },
      include: { user: false },
    });
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/favorites/:numberId', authenticate, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.favorite.findUnique({
      where: { userId_numberId: { userId: req.user!.userId, numberId: req.params.numberId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return res.json({ favorited: false });
    }

    await prisma.favorite.create({
      data: { userId: req.user!.userId, numberId: req.params.numberId },
    });
    res.json({ favorited: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/balance/topup', authenticate, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user!.userId },
        data: { balance: { increment: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user!.userId,
          type: 'DEPOSIT',
          amount,
          description: 'Balance top-up',
        },
      }),
    ]);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { balance: true },
    });

    res.json({ balance: user?.balance });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { username: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, username: true, role: true, balance: true, isActive: true, createdAt: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ data: users, pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/toggle', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, isActive: true },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
