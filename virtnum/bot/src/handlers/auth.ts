import { Context } from 'telegraf';
import { prisma } from '../prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import { getSession, setSession, clearSession, isLoggedIn } from '../utils/session';
import { mainMenuKeyboard, cancelKeyboard } from '../utils/keyboards';

export async function handleLogin(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (isLoggedIn(telegramId)) {
    const session = getSession(telegramId);
    await ctx.reply(`✅ Вы уже вошли как *${session.username}*`, {
      parse_mode: 'Markdown',
      ...mainMenuKeyboard(session.role === 'ADMIN'),
    });
    return;
  }
  setSession(telegramId, { state: 'awaiting_login_email' });
  await ctx.reply(
    '🔑 *Вход в аккаунт*\n\nВведите ваш email:',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

export async function handleRegister(ctx: Context) {
  const telegramId = ctx.from!.id;
  if (isLoggedIn(telegramId)) {
    await ctx.reply('Вы уже авторизованы. Сначала выйдите из аккаунта.');
    return;
  }
  setSession(telegramId, { state: 'awaiting_register_email' });
  await ctx.reply(
    '📝 *Регистрация*\n\nВведите ваш email:',
    { parse_mode: 'Markdown', ...cancelKeyboard() }
  );
}

export async function handleLogout(ctx: Context) {
  const telegramId = ctx.from!.id;
  clearSession(telegramId);
  const { authKeyboard } = await import('../utils/keyboards');
  await ctx.reply('👋 Вы вышли из аккаунта.', authKeyboard());
}

export async function processAuthInput(ctx: Context, text: string): Promise<boolean> {
  const telegramId = ctx.from!.id;
  const session = getSession(telegramId);

  if (!session.state) return false;

  // ── REGISTRATION FLOW ──
  if (session.state === 'awaiting_register_email') {
    if (!/\S+@\S+\.\S+/.test(text)) {
      await ctx.reply('❌ Неверный формат email. Попробуйте снова:');
      return true;
    }
    setSession(telegramId, { state: 'awaiting_register_username', tempData: { email: text } });
    await ctx.reply('Придумайте имя пользователя (только буквы, цифры, _):');
    return true;
  }

  if (session.state === 'awaiting_register_username') {
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(text)) {
      await ctx.reply('❌ Имя пользователя: 3-30 символов, только буквы, цифры и _');
      return true;
    }
    setSession(telegramId, {
      state: 'awaiting_register_password',
      tempData: { ...session.tempData, username: text },
    });
    await ctx.reply('Придумайте пароль (минимум 8 символов):');
    return true;
  }

  if (session.state === 'awaiting_register_password') {
    if (text.length < 8) {
      await ctx.reply('❌ Пароль должен быть не менее 8 символов:');
      return true;
    }
    const { email, username } = session.tempData!;
    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        await ctx.reply(`❌ ${existing.email === email ? 'Email уже занят' : 'Имя пользователя занято'}. Начните регистрацию заново.`);
        setSession(telegramId, { state: undefined, tempData: undefined });
        return true;
      }
      const passwordHash = await hashPassword(text);
      const user = await prisma.user.create({
        data: { email, username, passwordHash },
      });
      setSession(telegramId, {
        state: undefined,
        tempData: undefined,
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        balance: user.balance,
      });
      await ctx.reply(
        `✅ *Регистрация успешна!*\n\nДобро пожаловать, *${username}*! 🎉\nВаш баланс: $0.00`,
        { parse_mode: 'Markdown', ...mainMenuKeyboard() }
      );
    } catch (err) {
      await ctx.reply('❌ Ошибка при регистрации. Попробуйте позже.');
      setSession(telegramId, { state: undefined, tempData: undefined });
    }
    return true;
  }

  // ── LOGIN FLOW ──
  if (session.state === 'awaiting_login_email') {
    setSession(telegramId, { state: 'awaiting_login_password', tempData: { email: text } });
    await ctx.reply('Введите пароль:');
    return true;
  }

  if (session.state === 'awaiting_login_password') {
    const { email } = session.tempData!;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) {
        await ctx.reply('❌ Неверный email или пароль.');
        setSession(telegramId, { state: undefined, tempData: undefined });
        return true;
      }
      const valid = await comparePassword(text, user.passwordHash);
      if (!valid) {
        await ctx.reply('❌ Неверный email или пароль.');
        setSession(telegramId, { state: undefined, tempData: undefined });
        return true;
      }
      setSession(telegramId, {
        state: undefined,
        tempData: undefined,
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        balance: user.balance,
      });
      await ctx.reply(
        `✅ *Добро пожаловать, ${user.username}!*\n\n💰 Баланс: $${user.balance.toFixed(2)}`,
        { parse_mode: 'Markdown', ...mainMenuKeyboard(user.role === 'ADMIN') }
      );
    } catch (err) {
      await ctx.reply('❌ Ошибка входа. Попробуйте позже.');
      setSession(telegramId, { state: undefined, tempData: undefined });
    }
    return true;
  }

  return false;
}
