import { Router, Request, Response } from 'express';
import { prisma } from '../prisma/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { numbers: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(countries);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:code/numbers', async (req: Request, res: Response) => {
  try {
    const country = await prisma.country.findUnique({ where: { code: req.params.code } });
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const numbers = await prisma.virtualNumber.findMany({
      where: { countryId: country.id, status: 'AVAILABLE' },
      include: { country: true },
      orderBy: { price: 'asc' },
    });
    res.json(numbers);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
