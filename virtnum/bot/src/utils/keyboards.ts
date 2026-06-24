import { Markup } from 'telegraf';

export const mainMenuKeyboard = (isAdmin = false) => {
  const buttons = [
    [Markup.button.text('📱 Номера'), Markup.button.text('🛒 Мои заказы')],
    [Markup.button.text('💰 Баланс'), Markup.button.text('⭐️ Избранное')],
    [Markup.button.text('📩 SMS'), Markup.button.text('🔔 Уведомления')],
    [Markup.button.text('👤 Профиль'), Markup.button.text('ℹ️ Помощь')],
  ];
  if (isAdmin) {
    buttons.push([Markup.button.text('🔧 Админ панель')]);
  }
  return Markup.keyboard(buttons).resize();
};

export const backKeyboard = () =>
  Markup.keyboard([[Markup.button.text('◀️ Назад')]]).resize();

export const cancelKeyboard = () =>
  Markup.keyboard([[Markup.button.text('❌ Отмена')]]).resize();

export const authKeyboard = () =>
  Markup.keyboard([
    [Markup.button.text('🔑 Войти'), Markup.button.text('📝 Регистрация')],
  ]).resize();

export const numbersFilterKeyboard = () =>
  Markup.keyboard([
    [Markup.button.text('🇷🇺 Россия'), Markup.button.text('🇺🇸 США'), Markup.button.text('🇬🇧 UK')],
    [Markup.button.text('📲 Для Telegram'), Markup.button.text('🔍 Все номера')],
    [Markup.button.text('◀️ Назад')],
  ]).resize();

export const orderActionsKeyboard = (orderId: string) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('❌ Отменить заказ', `cancel_order:${orderId}`)],
    [Markup.button.callback('🔄 Обновить SMS', `refresh_sms:${orderId}`)],
  ]);
