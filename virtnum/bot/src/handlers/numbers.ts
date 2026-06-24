import { Context } from 'telegraf';
import { prisma } from '../prisma/client';
import { getSession, isLoggedIn } from '../utils/session';
import { numbersFilterKeyboard, backKeyboard, mainMenuKeyboard } from '../utils/keyboards';
import { formatNumber } from '../utils/format';
import { Markup } from 'telegraf';

export async function handleNumbers(ctx: Context) {
  await ctx.reply(
    '📱 *Виртуальные номера*\n\nВыберите фильтр или просмотрите все номера:',
    { parse_mode: 'Markdown', ...numbersFilterKeyboard() }
  );
}

export async function handleAllNumbers(ctx: Context, countryCode?: string, telegramOnly?: boolean) {
  try {
    const where: any = { status: 'AVAILABLE' };
    if (telegramOnly) where.isTelegram = true;
    if (countryCode) {
      const country = await prisma.country.findFirst({ where: { code: countryCode } });
      if (country) where.countryId = country.id;
    }

    const numbers = await prisma.virtualNumber.findMany({
      where,
      include: { country: true },
      take: 10,
      orderBy: { price: 'asc' },
    });

    if (numbers.length === 0) {
      await ctx.reply('😔 Нет доступных номеров по выбранному фильтру.', backKeyboard());
      return;
    }

    const header = telegramOnly
      ? '📲 *Номера для Telegram:*\n\n'
      : countryCode
      ? `🌍 *Номера (${countryCode}):*\n\n`
      : '📱 *Все доступные номера:*\n\n';

    await ctx.reply(header, { parse_mode: 'Markdown' });

    for (const number of numbers) {
      const text = formatNumber(number);
      const telegramId = ctx.from!.id;
      const loggedIn = isLoggedIn(telegramId);

      const buttons = loggedIn
        ? Markup.inlineKeyboard([
            [Markup.button.callback(`🛒 Купить $${number.price.toFixed(2)}`, `buy:${number.id}`)],
            [Markup.button.callback('⭐️ В избранное', `fav:${number.id}`)],
          ])
        : Markup.inlineKeyboard([
            [Markup.button.callback('🔑 Войти для покупки', 'need_login')],
          ]);

      await ctx.reply(text, { parse_mode: 'Markdown', ...buttons });
    }

    await ctx.reply(`Показано ${numbers.length} номеров`, backKeyboard());
  } catch (err) {
    await ctx.reply('❌ Ошибка при загрузке номеров.');
  }
}

export async function handleBuyNumber(ctx: Context, numberId: string) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.answerCbQuery('Сначала войдите в аккаунт!');
    return;
  }

  const session = getSession(telegramId);

  try {
    const number = await prisma.virtualNumber.findUnique({
      where: { id: numberId },
      include: { country: true },
    });

    if (!number || number.status !== 'AVAILABLE') {
      await ctx.answerCbQuery('❌ Номер уже недоступен');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) { await ctx.answerCbQuery('Ошибка: пользователь не найден'); return; }

    if (user.balance < number.price) {
      await ctx.answerCbQuery(`❌ Недостаточно средств. Баланс: $${user.balance.toFixed(2)}, нужно: $${number.price.toFixed(2)}`);
      return;
    }

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: { userId: user.id, numberId, status: 'ACTIVE', expiresAt },
        include: { number: { include: { country: true } } },
      }),
      prisma.virtualNumber.update({ where: { id: numberId }, data: { status: 'BUSY', expiresAt } }),
      prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: number.price } } }),
      prisma.transaction.create({
        data: { userId: user.id, type: 'PURCHASE', amount: -number.price, description: `Покупка номера ${number.number}` },
      }),
    ]);

    // update balance in session
    const { setSession } = await import('../utils/session');
    setSession(telegramId, { balance: user.balance - number.price });

    await ctx.answerCbQuery('✅ Номер куплен!');
    await ctx.reply(
      `✅ *Номер куплен успешно!*\n\n` +
      `📱 Номер: \`${number.number}\`\n` +
      `🌍 ${number.country.flag} ${number.country.name}\n` +
      `💰 Списано: $${number.price.toFixed(2)}\n` +
      `⏰ Активен 20 минут (до ${expiresAt.toLocaleString('ru-RU')})\n\n` +
      `ID заказа: \`${order.id}\``,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📩 Ждать SMS', `refresh_sms:${order.id}`)],
          [Markup.button.callback('❌ Отменить', `cancel_order:${order.id}`)],
        ]),
      }
    );
  } catch (err) {
    await ctx.answerCbQuery('❌ Ошибка при покупке');
  }
}

export async function handleAddFavorite(ctx: Context, numberId: string) {
  const telegramId = ctx.from!.id;
  if (!isLoggedIn(telegramId)) {
    await ctx.answerCbQuery('Сначала войдите в аккаунт!');
    return;
  }
  const session = getSession(telegramId);
  try {
    await prisma.favorite.upsert({
      where: { userId_numberId: { userId: session.userId!, numberId } },
      create: { userId: session.userId!, numberId },
      update: {},
    });
    await ctx.answerCbQuery('⭐️ Добавлено в избранное!');
  } catch {
    await ctx.answerCbQuery('❌ Ошибка');
  }
}
