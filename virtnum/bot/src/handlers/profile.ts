import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../prisma/client';
import { getSession, isLoggedIn, setSession } from '../utils/session';
import { mainMenuKeyboard, backKeyboard } from '../utils/keyboards';

export async function handleProfile(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.reply('🔑 Вы не авторизованы.', mainMenuKeyboard());
    return;
  }
  const session = getSession(telegramId);

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, username: true, role: true, balance: true, isVerified: true, createdAt: true },
    });

    if (!user) { await ctx.reply('Пользователь не найден'); return; }

    setSession(telegramId, { balance: user.balance });

    await ctx.reply(
      `👤 *Ваш профиль*\n\n` +
      `📛 Имя: *${user.username}*\n` +
      `📧 Email: ${user.email}\n` +
      `🛡 Роль: ${user.role === 'ADMIN' ? '🔧 Администратор' : '👤 Пользователь'}\n` +
      `✅ Верификация: ${user.isVerified ? '✅ Подтверждён' : '❌ Не подтверждён'}\n` +
      `💰 Баланс: *$${user.balance.toFixed(2)}*\n` +
      `📅 Зарегистрирован: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚪 Выйти из аккаунта', 'logout')],
        ]),
      }
    );
  } catch {
    await ctx.reply('❌ Ошибка загрузки профиля');
  }
}

export async function handleBalance(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.reply('🔑 Войдите в аккаунт для просмотра баланса.');
    return;
  }
  const session = getSession(telegramId);

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { balance: true },
    });

    const transactions = await prisma.transaction.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    setSession(telegramId, { balance: user?.balance || 0 });

    const txLines = transactions.map(tx => {
      const sign = tx.amount > 0 ? '+' : '';
      const emoji = tx.type === 'DEPOSIT' ? '💳' : tx.type === 'REFUND' ? '↩️' : '🛒';
      return `${emoji} ${sign}$${tx.amount.toFixed(2)} — ${tx.description}`;
    }).join('\n');

    await ctx.reply(
      `💰 *Баланс: $${(user?.balance || 0).toFixed(2)}*\n\n` +
      (txLines ? `📋 *Последние транзакции:*\n${txLines}` : '📭 Транзакций пока нет'),
      { parse_mode: 'Markdown' }
    );
  } catch {
    await ctx.reply('❌ Ошибка при загрузке баланса');
  }
}

export async function handleFavorites(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.reply('🔑 Войдите в аккаунт для просмотра избранного.');
    return;
  }
  const session = getSession(telegramId);

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: session.userId },
      include: { virtualNumber: { include: { country: true } } },
      take: 10,
    });

    if (favorites.length === 0) {
      await ctx.reply('⭐️ Список избранного пуст.\n\nДобавляйте номера через кнопку ⭐️ при просмотре.', backKeyboard());
      return;
    }

    await ctx.reply(`⭐️ *Избранные номера (${favorites.length}):*`, { parse_mode: 'Markdown' });

    for (const fav of favorites) {
      const { formatNumber } = await import('../utils/format');
      const text = formatNumber(fav.virtualNumber as any);

      const isAvailable = fav.virtualNumber!.status === 'AVAILABLE';
      const buttons = isAvailable
        ? Markup.inlineKeyboard([
            [Markup.button.callback(`🛒 Купить $${fav.virtualNumber!.price.toFixed(2)}`, `buy:${fav.virtualNumber!.id}`)],
            [Markup.button.callback('🗑 Удалить из избранного', `unfav:${fav.id}`)],
          ])
        : Markup.inlineKeyboard([
            [Markup.button.callback('🗑 Удалить из избранного', `unfav:${fav.id}`)],
          ]);

      await ctx.reply(text, { parse_mode: 'Markdown', ...buttons });
    }
  } catch {
    await ctx.reply('❌ Ошибка при загрузке избранного');
  }
}

export async function handleRemoveFavorite(ctx: Context, favId: string) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) { await ctx.answerCbQuery('Войдите в аккаунт'); return; }
  try {
    await prisma.favorite.delete({ where: { id: favId } });
    await ctx.answerCbQuery('🗑 Удалено из избранного');
    await ctx.editMessageText('🗑 Номер удалён из избранного.');
  } catch {
    await ctx.answerCbQuery('❌ Ошибка');
  }
}
