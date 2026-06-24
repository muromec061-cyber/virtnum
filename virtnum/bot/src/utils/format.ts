export function formatBalance(balance: number): string {
  return `$${balance.toFixed(2)}`;
}

export function formatNumber(number: any): string {
  const statusEmoji: Record<string, string> = {
    AVAILABLE: '🟢',
    BUSY: '🔴',
    EXPIRED: '⚫️',
    BLOCKED: '🚫',
  };
  const emoji = statusEmoji[number.status] || '⚪️';
  return (
    `${emoji} *${number.number}*\n` +
    `🌍 ${number.country?.flag || ''} ${number.country?.name || ''}\n` +
    `💰 Цена: $${number.price.toFixed(2)}\n` +
    `${number.isTelegram ? '✅ Поддерживает Telegram' : ''}`
  );
}

export function formatOrder(order: any): string {
  const statusEmoji: Record<string, string> = {
    PENDING: '⏳',
    ACTIVE: '🟢',
    COMPLETED: '✅',
    CANCELLED: '❌',
    EXPIRED: '⏰',
  };
  const emoji = statusEmoji[order.status] || '⚪️';
  const expires = order.expiresAt
    ? new Date(order.expiresAt).toLocaleString('ru-RU')
    : '—';
  return (
    `${emoji} Заказ #${order.id.slice(-6)}\n` +
    `📱 Номер: \`${order.number?.number || '—'}\`\n` +
    `🌍 ${order.number?.country?.flag || ''} ${order.number?.country?.name || ''}\n` +
    `📊 Статус: ${order.status}\n` +
    `⏰ Истекает: ${expires}`
  );
}

export function formatSms(sms: any): string {
  return (
    `📩 *SMS от ${sms.sender}*\n` +
    `📱 На номер: \`${sms.number?.number || '—'}\`\n` +
    `💬 ${sms.text}\n` +
    `${sms.code ? `🔑 Код: *${sms.code}*\n` : ''}` +
    `🕐 ${new Date(sms.createdAt).toLocaleString('ru-RU')}`
  );
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
