import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { logAction } from '../middleware/actionLog';
import { logger } from '../utils/logger';
import { wsManager } from '../websocket/manager';

const router = Router();

router.get('/', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      country,
      status,
      telegram,
      minPrice,
      maxPrice,
      search,
      page = '1',
      limit = '20',
    } = req.query;

    const where: any = {};
    if (country) where.countryId = country;
    if (status) where.status = status;
    if (telegram === 'true') where.isTelegram = true;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }
    if (search) {
      where.number = { contains: search as string };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [numbers, total] = await Promise.all([
      prisma.virtualNumber.findMany({
        where,
        include: { country: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.virtualNumber.count({ where }),
    ]);

    res.json({
      data: numbers,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    logger.error('Get numbers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/telegram', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const numbers = await prisma.virtualNumber.findMany({
      where: { isTelegram: true, status: 'AVAILABLE' },
      include: { country: true },
      take: 50,
      orderBy: { price: 'asc' },
    });
    res.json(numbers);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const number = await prisma.virtualNumber.findUnique({
      where: { id: req.params.id },
      include: { country: true, smsMessages: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });

    if (!number) return res.status(404).json({ error: 'Number not found' });
    res.json(number);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const createNumberSchema = z.object({
  number: z.string().min(7).max(20),
  countryId: z.string(),
  price: z.number().positive(),
  isTelegram: z.boolean().optional(),
});

router.post('/', authenticate, requireAdmin, validate(createNumberSchema), logAction('CREATE_NUMBER', 'VirtualNumber'), async (req: Request, res: Response) => {
  try {
    const { number, countryId, price, isTelegram } = req.body;

    const existing = await prisma.virtualNumber.findUnique({ where: { number } });
    if (existing) return res.status(409).json({ error: 'Number already exists' });

    const country = await prisma.country.findUnique({ where: { id: countryId } });
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const created = await prisma.virtualNumber.create({
      data: { number, countryId, price, isTelegram: isTelegram || false },
      include: { country: true },
    });

    res.status(201).json(created);
  } catch (err) {
    logger.error('Create number error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, requireAdmin, logAction('UPDATE_NUMBER', 'VirtualNumber'), async (req: Request, res: Response) => {
  try {
    const number = await prisma.virtualNumber.findUnique({ where: { id: req.params.id } });
    if (!number) return res.status(404).json({ error: 'Number not found' });

    const updated = await prisma.virtualNumber.update({
      where: { id: req.params.id },
      data: req.body,
      include: { country: true },
    });

    wsManager.broadcastNumberUpdate(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, requireAdmin, logAction('DELETE_NUMBER', 'VirtualNumber'), async (req: Request, res: Response) => {
  try {
    await prisma.virtualNumber.delete({ where: { id: req.params.id } });
    res.json({ message: 'Number deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
