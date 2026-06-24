import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../prisma/client';
import { getSession, isLoggedIn } from '../utils/session';
import { formatOrder, formatSms } from '../utils/format';
import { mainMenuKeyboard, backKeyboard } from '../utils/keyboards';

export async function handleMyOrders(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.reply('🔑 Сначала войдите в аккаунт.', mainMenuKeyboard());
    return;
  }
  const session = getSession(telegramId);

  try {
    const orders = await prisma.order.findMany({
      where: { userId: session.userId },
      include: {
        number: { include: { country: true } },
        smsMessages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (orders.length === 0) {
      await ctx.reply('📭 У вас пока нет заказов.', backKeyboard());
      return;
    }

    await ctx.reply(`🛒 *Ваши заказы (${orders.length}):*`, { parse_mode: 'Markdown' });

    for (const order of orders) {
      const text = formatOrder(order);
      const buttons: any[] = [];

      if (['PENDING', 'ACTIVE'].includes(order.status)) {
        buttons.push([Markup.button.callback('📩 SMS', `refresh_sms:${order.id}`)]);
        buttons.push([Markup.button.callback('❌ Отменить', `cancel_order:${order.id}`)]);
      }

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...(buttons.length ? Markup.inlineKeyboard(buttons) : {}),
      });
    }
  } catch (err) {
    await ctx.reply('❌ Ошибка при загрузке заказов.');
  }
}

export async function handleCancelOrder(ctx: Context, orderId: string) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.answerCbQuery('Сначала войдите!');
    return;
  }
  const session = getSession(telegramId);

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { number: true },
    });

    if (!order) { await ctx.answerCbQuery('Заказ не найден'); return; }
    if (order.userId !== session.userId) { await ctx.answerCbQuery('Нет доступа'); return; }
    if (!['PENDING', 'ACTIVE'].includes(order.status)) {
      await ctx.answerCbQuery('Заказ нельзя отменить');
      return;
    }

    const refund = order.number.price * 0.5;

    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } }),
      prisma.virtualNumber.update({ where: { id: order.numberId }, data: { status: 'AVAILABLE', expiresAt: null } }),
      prisma.user.update({ where: { id: order.userId }, data: { balance: { increment: refund } } }),
      prisma.transaction.create({
        data: { userId: order.userId, type: 'REFUND', amount: refund, description: 'Частичный возврат за отмену заказа' },
      }),
    ]);

    const { setSession } = await import('../utils/session');
    setSession(telegramId, { balance: (session.balance || 0) + refund });

    await ctx.answerCbQuery(`✅ Отменено. Возврат: $${refund.toFixed(2)}`);
    await ctx.editMessageText(
      `❌ Заказ отменён\n\nВозврат на баланс: $${refund.toFixed(2)} (50%)`,
      { parse_mode: 'Markdown' }
    );
  } catch {
    await ctx.answerCbQuery('❌ Ошибка при отмене');
  }
}

export async function handleRefreshSms(ctx: Context, orderId: string) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.answerCbQuery('Сначала войдите!');
    return;
  }
  const session = getSession(telegramId);

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        number: true,
        smsMessages: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!order || order.userId !== session.userId) {
      await ctx.answerCbQuery('Нет доступа');
      return;
    }

    await ctx.answerCbQuery('🔄 Обновлено');

    if (order.smsMessages.length === 0) {
      await ctx.reply(`📭 SMS для номера \`${order.number.number}\` пока нет. Ждите...`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Обновить', `refresh_sms:${orderId}`)],
          [Markup.button.callback('❌ Отменить заказ', `cancel_order:${orderId}`)],
        ]),
      });
      return;
    }

    await ctx.reply(`📩 *SMS для номера* \`${order.number.number}\`:`, { parse_mode: 'Markdown' });
    for (const sms of order.smsMessages) {
      await ctx.reply(formatSms({ ...sms, number: order.number }), { parse_mode: 'Markdown' });
    }
  } catch {
    await ctx.answerCbQuery('❌ Ошибка');
  }
}
