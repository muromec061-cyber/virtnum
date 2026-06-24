import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../prisma/client';
import { getSession, isLoggedIn, setSession } from '../utils/session';
import { mainMenuKeyboard, cancelKeyboard } from '../utils/keyboards';

function isAdmin(ctx: Context): boolean {
  const telegramId = ctx.from!.id;
  const session = getSession(telegramId);
  return isLoggedIn(telegramId) && session.role === 'ADMIN';
}

export async function handleAdminPanel(ctx: Context) {
  if (!isAdmin(ctx)) {
    await ctx.reply('🚫 Доступ запрещён.');
    return;
  }

  try {
    const [userCount, numberCount, orderCount, activeOrders] = await Promise.all([
      prisma.user.count(),
      prisma.virtualNumber.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'ACTIVE' } }),
    ]);

    await ctx.reply(
      `🔧 *Панель администратора*\n\n` +
      `👥 Пользователей: *${userCount}*\n` +
      `📱 Номеров: *${numberCount}*\n` +
      `🛒 Заказов всего: *${orderCount}*\n` +
      `🟢 Активных заказов: *${activeOrders}*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📱 Управление номерами', 'admin_numbers')],
          [Markup.button.callback('👥 Список пользователей', 'admin_users')],
          [Markup.button.callback('🛒 Все заказы', 'admin_orders')],
          [Markup.button.callback('➕ Добавить номер', 'admin_add_number')],
        ]),
      }
    );
  } catch {
    await ctx.reply('❌ Ошибка загрузки панели');
  }
}

export async function handleAdminNumbers(ctx: Context) {
  if (!isAdmin(ctx)) { await ctx.answerCbQuery('Нет доступа'); return; }

  try {
    const numbers = await prisma.virtualNumber.findMany({
      include: { country: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    await ctx.answerCbQuery();
    await ctx.reply(`📱 *Номера (${numbers.length}):*`, { parse_mode: 'Markdown' });

    for (const num of numbers) {
      const statusEmoji: Record<string, string> = { AVAILABLE: '🟢', BUSY: '🔴', EXPIRED: '⚫️', BLOCKED: '🚫' };
      const text = `${statusEmoji[num.status] || '⚪️'} \`${num.number}\` — ${num.country.flag} ${num.country.name} — $${num.price.toFixed(2)}`;
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🗑 Удалить', `admin_del_num:${num.id}`)],
        ]),
      });
    }
  } catch {
    await ctx.answerCbQuery('❌ Ошибка');
  }
}

export async function handleAdminAddNumber(ctx: Context) {
  if (!isAdmin(ctx)) { await ctx.answerCbQuery?.('Нет доступа'); return; }
  const telegramId = ctx.from!.id;
  setSession(telegramId, { state: 'admin_add_number_step1', tempData: {} });
  await ctx.reply(
    '➕ *Добавить номер*\n\nВведите номер телефона (например: +79001234567):',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
  if ('answerCbQuery' in ctx) await (ctx as any).answerCbQuery();
}

export async function handleAdminUsers(ctx: Context) {
  if (!isAdmin(ctx)) { await ctx.answerCbQuery('Нет доступа'); return; }
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true, role: true, balance: true, isActive: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    await ctx.answerCbQuery();
    await ctx.reply(`👥 *Пользователи (${users.length}):*`, { parse_mode: 'Markdown' });
    for (const u of users) {
      await ctx.reply(
        `${u.isActive ? '🟢' : '🔴'} *${u.username}*\n📧 ${u.email}\n💰 $${u.balance.toFixed(2)} | ${u.role}`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch {
    await ctx.answerCbQuery('❌ Ошибка');
  }
}

export async function handleAdminOrders(ctx: Context) {
  if (!isAdmin(ctx)) { await ctx.answerCbQuery('Нет доступа'); return; }
  try {
    const orders = await prisma.order.findMany({
      include: { number: { include: { country: true } }, user: { select: { username: true } } },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    await ctx.answerCbQuery();
    await ctx.reply(`🛒 *Заказы (${orders.length}):*`, { parse_mode: 'Markdown' });
    for (const o of orders) {
      const { formatOrder } = await import('../utils/format');
      await ctx.reply(formatOrder(o) + `\n👤 ${o.user.username}`, { parse_mode: 'Markdown' });
    }
  } catch {
    await ctx.answerCbQuery('❌ Ошибка');
  }
}

export async function handleAdminDeleteNumber(ctx: Context, numId: string) {
  if (!isAdmin(ctx)) { await ctx.answerCbQuery('Нет доступа'); return; }
  try {
    await prisma.virtualNumber.delete({ where: { id: numId } });
    await ctx.answerCbQuery('✅ Номер удалён');
    await ctx.editMessageText('🗑 Номер удалён.');
  } catch {
    await ctx.answerCbQuery('❌ Ошибка при удалении');
  }
}

export async function processAdminInput(ctx: Context, text: string): Promise<boolean> {
  const telegramId = ctx.from!.id;
  if (!isAdmin(ctx)) return false;
  const { getSession, setSession } = await import('../utils/session');
  const session = getSession(telegramId);

  if (session.state === 'admin_add_number_step1') {
    if (!/^\+\d{7,15}$/.test(text)) {
      await ctx.reply('❌ Неверный формат. Пример: +79001234567');
      return true;
    }
    setSession(telegramId, { state: 'admin_add_number_step2', tempData: { number: text } });
    const countries = await prisma.country.findMany({ where: { isActive: true }, take: 20 });
    const list = countries.map((c, i) => `${i + 1}. ${c.flag} ${c.name} (${c.code})`).join('\n');
    setSession(telegramId, { tempData: { ...session.tempData, number: text, countries } });
    await ctx.reply(`Выберите страну (введите номер):\n${list}`);
    return true;
  }

  if (session.state === 'admin_add_number_step2') {
    const idx = parseInt(text) - 1;
    const countries = session.tempData?.countries;
    if (!countries || idx < 0 || idx >= countries.length) {
      await ctx.reply('❌ Неверный выбор');
      return true;
    }
    const country = countries[idx];
    setSession(telegramId, { state: 'admin_add_number_step3', tempData: { ...session.tempData, countryId: country.id } });
    await ctx.reply('Введите цену в USD (например: 0.50):');
    return true;
  }

  if (session.state === 'admin_add_number_step3') {
    const price = parseFloat(text);
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Неверная цена');
      return true;
    }
    setSession(telegramId, { state: 'admin_add_number_step4', tempData: { ...session.tempData, price } });
    await ctx.reply('Поддерживает Telegram? (да / нет):');
    return true;
  }

  if (session.state === 'admin_add_number_step4') {
    const isTelegram = text.toLowerCase() === 'да';
    const { number, countryId, price } = session.tempData!;
    try {
      const existing = await prisma.virtualNumber.findUnique({ where: { number } });
      if (existing) {
        await ctx.reply('❌ Такой номер уже существует');
        setSession(telegramId, { state: undefined, tempData: undefined });
        return true;
      }
      await prisma.virtualNumber.create({ data: { number, countryId, price, isTelegram } });
      setSession(telegramId, { state: undefined, tempData: undefined });
      const { mainMenuKeyboard } = await import('../utils/keyboards');
      await ctx.reply(`✅ Номер ${number} добавлен!`, mainMenuKeyboard(true));
    } catch {
      await ctx.reply('❌ Ошибка при добавлении номера');
      setSession(telegramId, { state: undefined, tempData: undefined });
    }
    return true;
  }

  return false;
}
