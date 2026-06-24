import { Router, Request, Response } from 'express';
import { prisma } from '../prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalNumbers,
      availableNumbers,
      totalOrders,
      activeOrders,
      totalRevenue,
      recentOrders,
      smsToday,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.virtualNumber.count(),
      prisma.virtualNumber.count({ where: { status: 'AVAILABLE' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'ACTIVE' } }),
      prisma.transaction.aggregate({
        where: { type: 'PURCHASE' },
        _sum: { amount: true },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, username: true } },
          number: { include: { country: true } },
        },
      }),
      prisma.smsMessage.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    const dailyRevenue = await prisma.$queryRaw<Array<{ date: string; revenue: number }>>`
      SELECT 
        DATE(created_at) as date,
        SUM(ABS(amount)) as revenue
      FROM transactions
      WHERE type = 'PURCHASE'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    res.json({
      users: { total: totalUsers, active: activeUsers },
      numbers: { total: totalNumbers, available: availableNumbers },
      orders: { total: totalOrders, active: activeOrders },
      revenue: {
        total: Math.abs(totalRevenue._sum.amount || 0),
        daily: dailyRevenue,
      },
      smsToday,
      recentOrders,
    });
  } catch (err) {
    logger.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', action, entity } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const where: any = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [logs, total] = await Promise.all([
      prisma.actionLog.findMany({
        where,
        include: { user: { select: { email: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.actionLog.count({ where }),
    ]);

    res.json({ data: logs, pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/countries', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({
      include: { _count: { select: { numbers: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(countries);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/countries', async (req: Request, res: Response) => {
  try {
    const { name, code, dialCode, flag } = req.body;
    const country = await prisma.country.create({
      data: { name, code, dialCode, flag },
    });
    res.status(201).json(country);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
