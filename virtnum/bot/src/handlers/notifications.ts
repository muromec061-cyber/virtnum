import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../prisma/client';
import { getSession, isLoggedIn } from '../utils/session';

export async function handleNotifications(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.reply('🔑 Войдите в аккаунт для просмотра уведомлений.');
    return;
  }
  const session = getSession(telegramId);

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (notifications.length === 0) {
      await ctx.reply('🔔 Уведомлений нет.');
      return;
    }

    await ctx.reply(`🔔 *Уведомления* (непрочитанных: ${unreadCount}):`, { parse_mode: 'Markdown' });

    for (const notif of notifications) {
      const emoji = notif.isRead ? '📭' : '📬';
      await ctx.reply(
        `${emoji} *${notif.title}*\n${notif.message}\n🕐 ${new Date(notif.createdAt).toLocaleString('ru-RU')}`,
        {
          parse_mode: 'Markdown',
          ...(!notif.isRead
            ? Markup.inlineKeyboard([[Markup.button.callback('✅ Прочитано', `read_notif:${notif.id}`)]])
            : {}),
        }
      );
    }

    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId: session.userId, isRead: false },
      data: { isRead: true },
    });
  } catch {
    await ctx.reply('❌ Ошибка при загрузке уведомлений');
  }
}

export async function handleSmsHistory(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.reply('🔑 Войдите в аккаунт.');
    return;
  }
  const session = getSession(telegramId);

  try {
    const orders = await prisma.order.findMany({
      where: { userId: session.userId },
      select: { id: true },
    });

    const orderIds = orders.map(o => o.id);

    const smsMessages = await prisma.smsMessage.findMany({
      where: { orderId: { in: orderIds } },
      include: { number: { include: { country: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (smsMessages.length === 0) {
      await ctx.reply('📭 SMS сообщений пока нет.');
      return;
    }

    await ctx.reply(`📩 *История SMS (${smsMessages.length}):*`, { parse_mode: 'Markdown' });
    const { formatSms } = await import('../utils/format');
    for (const sms of smsMessages) {
      await ctx.reply(formatSms(sms), { parse_mode: 'Markdown' });
    }
  } catch {
    await ctx.reply('❌ Ошибка при загрузке SMS');
  }
}
