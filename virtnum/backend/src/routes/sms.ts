import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { smsRateLimiter } from '../middleware/rateLimiter';
import { wsManager } from '../websocket/manager';
import { logger } from '../utils/logger';

const router = Router();

const extractCode = (text: string): string | null => {
  const patterns = [
    /\b(\d{5,6})\b/,
    /code[:\s]+(\d{4,8})/i,
    /код[:\s]+(\d{4,8})/i,
    /otp[:\s]+(\d{4,8})/i,
    /verification[:\s]+(\d{4,8})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
};

router.get('/number/:numberId', authenticate, smsRateLimiter, async (req: Request, res: Response) => {
  try {
    const number = await prisma.virtualNumber.findUnique({ where: { id: req.params.numberId } });
    if (!number) return res.status(404).json({ error: 'Number not found' });

    const order = await prisma.order.findFirst({
      where: { numberId: req.params.numberId, userId: req.user!.userId, status: 'ACTIVE' },
    });

    if (!order && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No active order for this number' });
    }

    const messages = await prisma.smsMessage.findMany({
      where: { numberId: req.params.numberId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/order/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const messages = await prisma.smsMessage.findMany({
      where: { orderId: req.params.orderId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const incomingSchema = z.object({
  number: z.string(),
  sender: z.string(),
  text: z.string(),
  apiKey: z.string(),
});

router.post('/incoming', validate(incomingSchema), async (req: Request, res: Response) => {
  try {
    const { number, sender, text, apiKey } = req.body;

    if (apiKey !== process.env.SMS_GATEWAY_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const virtualNumber = await prisma.virtualNumber.findUnique({ where: { number } });
    if (!virtualNumber) return res.status(404).json({ error: 'Number not found' });

    const activeOrder = await prisma.order.findFirst({
      where: { numberId: virtualNumber.id, status: 'ACTIVE' },
    });

    const code = extractCode(text);

    const sms = await prisma.smsMessage.create({
      data: {
        numberId: virtualNumber.id,
        orderId: activeOrder?.id,
        sender,
        text,
        code,
      },
    });

    wsManager.broadcastSmsReceived(sms, virtualNumber.id, activeOrder?.userId);

    if (activeOrder) {
      await prisma.order.update({
        where: { id: activeOrder.id },
        data: { status: 'COMPLETED' },
      });
      await prisma.virtualNumber.update({
        where: { id: virtualNumber.id },
        data: { status: 'AVAILABLE', expiresAt: null },
      });
    }

    logger.info(`SMS received for ${number} from ${sender}`);
    res.json({ success: true, smsId: sms.id });
  } catch (err) {
    logger.error('Incoming SMS error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/simulate', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { numberId, sender, text } = req.body;

    const virtualNumber = await prisma.virtualNumber.findUnique({ where: { id: numberId } });
    if (!virtualNumber) return res.status(404).json({ error: 'Number not found' });

    const activeOrder = await prisma.order.findFirst({
      where: { numberId, status: 'ACTIVE' },
    });

    const code = extractCode(text);

    const sms = await prisma.smsMessage.create({
      data: {
        numberId,
        orderId: activeOrder?.id,
        sender: sender || 'Telegram',
        text,
        code,
      },
    });

    wsManager.broadcastSmsReceived(sms, numberId, activeOrder?.userId);

    res.json(sms);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
