// Aisunio Bot — AI Super Agent with 21 working models
import { Telegraf, Markup, session } from 'telegraf';
import http from 'http';
import https from 'https';

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GH_TOKEN = process.env.GITHUB_ACCESS_TOKEN!;
const PORT = parseInt(process.env.PORT || '3000');
const ADMIN_USERNAME = 'Dollarkiil';
const ADMIN_ID = 0; // будет установлен при первом /start

if (!BOT_TOKEN) { console.error('NO TELEGRAM_BOT_TOKEN'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);

// ═══════════════════════════════════════════════
// MODELS — only WORKING ones (tested 2025-06-25)
// ═══════════════════════════════════════════════
interface Model {
  idx: number;
  id: string;
  name: string;
  emoji: string;
  desc: string;
  vendor: string;
  provider: 'github' | 'llm7' | 'pollinations';
  llm7Model?: string;
  premium?: boolean;
}

const MODELS: Model[] = [
  // OpenAI (5)
  { idx: 0, id: 'openai/gpt-4o', name: 'GPT-4o', emoji: '🟢', desc: 'Самый умный', vendor: 'OpenAI', provider: 'github' },
  { idx: 1, id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', emoji: '⚡', desc: 'Быстрый', vendor: 'OpenAI', provider: 'github' },
  { idx: 2, id: 'openai/gpt-4.1', name: 'GPT-4.1', emoji: '🔵', desc: 'GPT-4.1', vendor: 'OpenAI', provider: 'github' },
  { idx: 3, id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', emoji: '🔷', desc: 'Mini', vendor: 'OpenAI', provider: 'github' },
  { idx: 4, id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', emoji: '▪️', desc: 'Nano', vendor: 'OpenAI', provider: 'github' },
  // DeepSeek (2)
  { idx: 5, id: 'deepseek/deepseek-v3-0324', name: 'DeepSeek-V3', emoji: '🐍', desc: 'Универсальный', vendor: 'DeepSeek', provider: 'github' },
  { idx: 6, id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek-R1', emoji: '🐉', desc: 'Reasoning', vendor: 'DeepSeek', provider: 'github' },
  // Meta (3) — убраны мёртвые 405b и 8b
  { idx: 7, id: 'meta/llama-3.3-70b-instruct', name: 'Llama-3.3-70B', emoji: '🦁', desc: 'Llama 70B', vendor: 'Meta', provider: 'github' },
  { idx: 8, id: 'meta/llama-4-maverick-17b-128e-instruct-fp8', name: 'Llama-4-Maverick', emoji: '🐅', desc: 'Llama 4', vendor: 'Meta', provider: 'github' },
  { idx: 9, id: 'meta/llama-4-scout-17b-16e-instruct', name: 'Llama-4-Scout', emoji: '🐆', desc: 'Llama 4 Scout', vendor: 'Meta', provider: 'github' },
  // Mistral (4)
  { idx: 10, id: 'mistral-ai/mistral-medium-2505', name: 'Mistral Medium', emoji: '🌬️', desc: 'Medium 3', vendor: 'Mistral', provider: 'github' },
  { idx: 11, id: 'mistral-ai/mistral-small-2503', name: 'Mistral Small', emoji: '💨', desc: 'Small 3.1', vendor: 'Mistral', provider: 'github' },
  { idx: 12, id: 'mistral-ai/codestral-2501', name: 'Codestral', emoji: '💻', desc: 'Для кода', vendor: 'Mistral', provider: 'github' },
  { idx: 13, id: 'mistral-ai/ministral-3b', name: 'Ministral-3B', emoji: '🌀', desc: 'Mini 3B', vendor: 'Mistral', provider: 'github' },
  // Microsoft (3) — убран мёртвый multimodal
  { idx: 14, id: 'microsoft/phi-4', name: 'Phi-4', emoji: '🔷', desc: 'Phi-4', vendor: 'Microsoft', provider: 'github' },
  { idx: 15, id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', emoji: '🔹', desc: 'Mini', vendor: 'Microsoft', provider: 'github' },
  { idx: 16, id: 'microsoft/phi-4-reasoning', name: 'Phi-4 Reasoning', emoji: '🧩', desc: 'Reasoning', vendor: 'Microsoft', provider: 'github' },
  // Cohere (1)
  { idx: 17, id: 'cohere/cohere-command-a', name: 'Command-A', emoji: '📋', desc: 'Cohere', vendor: 'Cohere', provider: 'github' },
  // LLM7.io (2) — free, no key
  { idx: 18, id: 'llm7:qwen3-235b', name: 'Qwen3-235B', emoji: '🌸', desc: 'Qwen 3', vendor: 'Qwen', provider: 'llm7', llm7Model: 'qwen3-235b' },
  { idx: 19, id: 'llm7:codestral-latest', name: 'Codestral-LLM7', emoji: '🗝️', desc: 'Free', vendor: 'LLM7', provider: 'llm7', llm7Model: 'codestral-latest' },
  // Pollinations (1) — free fallback
  { idx: 20, id: 'poll:openai-fast', name: 'GPT-OSS-20B', emoji: '🆓', desc: 'Fallback', vendor: 'Pollinations', provider: 'pollinations' },
];

const DEFAULT_MODEL = 1; // GPT-4o Mini

// ═══════════════════════════════════════════════
// SUBSCRIPTION PLANS
// ═══════════════════════════════════════════════
interface Plan {
  id: string;
  name: string;
  price: number;
  tokensPerDay: number; // -1 = unlimited
  durationDays: number;
  features: string[];
}

const PLANS: Plan[] = [
  { id: 'free', name: 'Free', price: 0, tokensPerDay: 35, durationDays: 0, features: ['35 запросов/день', '18 моделей', 'Базовая поддержка'] },
  { id: 'premium_month', name: 'Premium Monthly', price: 499, tokensPerDay: -1, durationDays: 30, features: ['Безлимит', 'Все 21 модели', 'OpenClaw', 'Генерация изображений', 'Приоритет'] },
  { id: 'premium_year', name: 'Premium Yearly', price: 3990, tokensPerDay: -1, durationDays: 365, features: ['Безлимит', 'Все 21 модели', 'OpenClaw', 'Генерация изображений', 'Приоритет', 'Выгода 33%'] },
];

// ═══════════════════════════════════════════════
// USER STORAGE (in-memory)
// ═══════════════════════════════════════════════
interface User {
  id: number;
  username: string;
  firstName: string;
  modelIdx: number;
  premiumUntil: number;
  tokensUsed: number;
  tokensResetAt: number;
  isAdmin: boolean;
  isBanned: boolean;
  lastMsg: number;
}

const users = new Map<number, User>();
let totalUsers = 0;

function getUser(id: number, username?: string, firstName?: string): User {
  let u = users.get(id);
  const isAdmin = (username?.toLowerCase() === ADMIN_USERNAME.toLowerCase()) || (id === ADMIN_ID);
  if (!u) {
    u = {
      id, username: username || '', firstName: firstName || '',
      modelIdx: DEFAULT_MODEL, premiumUntil: 0,
      tokensUsed: 0, tokensResetAt: Date.now() + 86400000,
      isAdmin, isBanned: false, lastMsg: Date.now(),
    };
    users.set(id, u);
    totalUsers++;
  } else {
    // Обновляем admin при каждом вызове (case-insensitive)
    u.isAdmin = isAdmin;
    if (username) u.username = username;
    if (firstName) u.firstName = firstName;
    u.lastMsg = Date.now();
  }
  return u;
}

function isPremium(u: User): boolean {
  return u.isAdmin || u.premiumUntil > Date.now();
}

function getTokensLeft(u: User): number {
  if (u.isAdmin) return -1;
  if (isPremium(u)) return -1;
  if (Date.now() > u.tokensResetAt) {
    u.tokensUsed = 0;
    u.tokensResetAt = Date.now() + 86400000;
  }
  const plan = PLANS[0];
  return Math.max(0, plan.tokensPerDay - u.tokensUsed);
}

function useToken(u: User): boolean {
  if (u.isAdmin) return true;
  if (isPremium(u)) return true;
  if (Date.now() > u.tokensResetAt) {
    u.tokensUsed = 0;
    u.tokensResetAt = Date.now() + 86400000;
  }
  if (u.tokensUsed >= PLANS[0].tokensPerDay) return false;
  u.tokensUsed++;
  return true;
}

function timeLeft(ts: number): string {
  const ms = ts - Date.now();
  if (ms <= 0) return 'истекла';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}д ${hours}ч` : `${hours}ч`;
}

// ═══════════════════════════════════════════════
// AI API CALLS
// ═══════════════════════════════════════════════
function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function cleanAIResponse(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<ils>[\s\S]*?<\/ils>/gi, '')
    .replace(/<ild>[\s\S]*?<\/ild>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();
}

async function aiChatGitHub(prompt: string, systemPrompt: string, modelId: string): Promise<string> {
  const body = JSON.stringify({
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });
  const resp = await httpsPost(
    'https://models.github.ai/inference/chat/completions',
    { 'Authorization': `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' },
    body
  );
  const d = JSON.parse(resp);
  if (d.error) throw new Error(d.error.message || 'GitHub API error');
  if (!d.choices || !d.choices[0]) throw new Error('No response from GitHub Models');
  return cleanAIResponse(d.choices[0].message.content);
}

async function aiChatLLM7(prompt: string, systemPrompt: string, model: string): Promise<string> {
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 2000,
  });
  const resp = await httpsPost(
    'https://api.llm7.io/v1/chat/completions',
    { 'Content-Type': 'application/json' },
    body
  );
  const d = JSON.parse(resp);
  if (d.error) throw new Error(d.error.message || 'LLM7 error');
  if (!d.choices || !d.choices[0]) throw new Error('No response from LLM7');
  return cleanAIResponse(d.choices[0].message.content);
}

async function aiChatPollinations(prompt: string, systemPrompt: string): Promise<string> {
  const body = JSON.stringify({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    model: 'openai',
  });
  const resp = await httpsPost(
    'https://text.pollinations.ai/',
    { 'Content-Type': 'application/json' },
    body
  );
  return cleanAIResponse(resp);
}

async function aiChat(prompt: string, systemPrompt: string, model: Model): Promise<string> {
  if (model.provider === 'github') {
    return aiChatGitHub(prompt, systemPrompt, model.id);
  } else if (model.provider === 'llm7') {
    return aiChatLLM7(prompt, systemPrompt, model.llm7Model || 'qwen3-235b');
  } else {
    return aiChatPollinations(prompt, systemPrompt);
  }
}

// Auto-fallback: GitHub model fails → GPT-4o-mini → Pollinations
async function aiChatWithFallback(prompt: string, systemPrompt: string, model: Model): Promise<string> {
  try {
    return await aiChat(prompt, systemPrompt, model);
  } catch (e1) {
    console.log(`Model ${model.id} failed: ${(e1 as Error).message}, falling back...`);
    if (model.provider !== 'github' || model.id === 'openai/gpt-4o-mini') {
      // Already non-GitHub or already GPT-4o-mini, go to Pollinations
      try {
        return await aiChatPollinations(prompt, systemPrompt);
      } catch (e2) {
        throw new Error('All AI providers failed');
      }
    }
    // Try GPT-4o-mini fallback
    try {
      return await aiChatGitHub(prompt, systemPrompt, 'openai/gpt-4o-mini');
    } catch (e3) {
      return await aiChatPollinations(prompt, systemPrompt);
    }
  }
}

// ═══════════════════════════════════════════════
// IMAGE GENERATION (Pollinations — free)
// ═══════════════════════════════════════════════
function genImageUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt.slice(0, 200));
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
}

// ═══════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════
function mainKeyboard(u: User) {
  return Markup.keyboard([
    ['💬 Чат', '🎨 Картинка'],
    ['🤖 Модели', '💎 Премиум'],
    ['📊 Профиль', ...(u.isAdmin ? ['🔐 Админ'] : ['❓ Помощь'])],
  ]).resize();
}

// ═══════════════════════════════════════════════
// BOT COMMANDS
// ═══════════════════════════════════════════════
bot.start(async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  
  const tokens = getTokensLeft(u);
  const adminPremium = u.isAdmin;
  
  let text = `🤖 <b>Добро пожаловать, ${u.firstName || u.username || 'друг'}!</b>\n\n`;
  text += `Я — AI бот с <b>${MODELS.length} моделями</b> от 8 провайдеров.\n`;
  text += `GPT-4o, DeepSeek, Llama, Mistral, Phi-4 и другие.\n\n`;
  text += `📊 <b>Подписка:</b> ${adminPremium ? '👑 Premium ∞ (Админ)' : isPremium(u) ? '💎 Premium' : '🆓 Free'}\n`;
  if (adminPremium) text += `⏰ До: ∞ Бессрочно\n`;
  else if (isPremium(u)) text += `⏰ До: ${timeLeft(u.premiumUntil)}\n`;
  else text += `🎯 Осталось: ${tokens === -1 ? '∞' : tokens + '/35'} запросов\n\n`;
  text += `Просто напиши мне что-нибудь — я отвечу! 👇`;
  
  await ctx.reply(text, { parse_mode: 'HTML', ...mainKeyboard(u) });
});

bot.command('help', async (ctx) => {
  const text = `<b>📖 Команды:</b>\n\n` +
    `💬 Просто напиши текст — AI ответит\n` +
    `🤖 /models — выбрать модель (${MODELS.length} шт.)\n` +
    `🎨 /img &lt;описание&gt; — генерация картинки\n` +
    `📊 /profile — ваш профиль\n` +
    `💎 /premium — подписка Premium\n` +
    `🦅 /openclaw &lt;задача&gt; — AI агент\n` +
    `🌐 /translate &lt;текст&gt; — перевод\n` +
    `💻 /code &lt;задача&gt; — код\n` +
    `🌦 /weather &lt;город&gt; — погода\n` +
    `⏰ /time — время\n` +
    `🎲 /dice — кубик | 🪙 /coin — орёл/решка\n` +
    `🔢 /calc &lt;выражение&gt; — калькулятор\n` +
    `🔒 /pass — пароль | 🆔 /uuid — UUID\n` +
    `📊 /status — статус бота`;
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// ─── /models ───
bot.command('models', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  
  const buttons = MODELS.map((m, i) => {
    const active = u.modelIdx === i ? '✅ ' : '';
    const prem = m.premium && !isPremium(u) ? '🔒 ' : '';
    return [Markup.button.callback(`${active}${m.emoji} ${m.name}`, `m${i}`)];
  });
  
  await ctx.reply(`🤖 <b>Выбор модели (${MODELS.length})</b>\n\nТекущая: ${MODELS[u.modelIdx].emoji} ${MODELS[u.modelIdx].name}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons),
  });
});

// Model selection callbacks
MODELS.forEach((m, i) => {
  bot.action(`m${i}`, async (ctx) => {
    const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
    if (m.premium && !isPremium(u)) {
      await ctx.answerCbQuery('🔒 Только для Premium!');
      return;
    }
    u.modelIdx = i;
    await ctx.answerCbQuery(`✅ ${m.name}`);
    await ctx.editMessageText(`✅ Выбрана модель: ${m.emoji} <b>${m.name}</b>\n${m.desc}`, { parse_mode: 'HTML' });
  });
});

// ─── /profile ───
bot.command('profile', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  
  const tokens = getTokensLeft(u);
  const adminPremium = u.isAdmin;
  
  let text = `📊 <b>Ваш профиль</b>\n\n`;
  text += `👤 Имя: ${u.firstName || u.username || 'Аноним'}\n`;
  text += `🆔 ID: ${u.id}\n`;
  text += `🤖 Модель: ${MODELS[u.modelIdx].emoji} ${MODELS[u.modelIdx].name}\n`;
  text += `📊 Подписка: ${adminPremium ? '👑 Premium ∞ (Админ)' : isPremium(u) ? '💎 Premium' : '🆓 Free'}\n`;
  if (adminPremium) text += `⏰ До: ∞ Бессрочно\n`;
  else if (isPremium(u)) text += `⏰ До: ${timeLeft(u.premiumUntil)}\n`;
  else text += `🎯 Запросов сегодня: ${tokens === -1 ? '∞ Безлимит' : tokens + '/35'}\n`;
  
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// ─── /premium ───
bot.command('premium', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  
  const adminPremium = u.isAdmin;
  
  let text = `<b>💎 Подписка Premium</b>\n\n`;
  if (isPremium(u)) {
    text += `✅ У вас активна Premium\n`;
    text += `⏰ До: ${adminPremium ? '∞ Бессрочно (Админ)' : timeLeft(u.premiumUntil)}\n\n`;
  } else {
    text += `🆓 Сейчас: Free (35 запросов/день)\n\n`;
    text += `<b>Premium даёт:</b>\n  ∞ Безлимит\n  🚀 Все ${MODELS.length} моделей\n  🦅 OpenClaw\n  🎨 Изображения\n  ⚡ Приоритет\n\n`;
    text += `<b>Тарифы:</b>\n  💎 Месяц — 499₽\n  🏆 Год — 3990₽ (выгода 33%)\n\n`;
    text += `Для оплаты напишите @Dollarkiil`;
  }
  
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// ─── /status ───
bot.command('status', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const tokens = getTokensLeft(u);
  const adminPremium = u.isAdmin;
  
  let text = `📊 <b>Статус бота</b>\n\n`;
  text += `🟢 Онлайн\n`;
  text += `🤖 Моделей: ${MODELS.length}\n`;
  text += `👥 Пользователей: ${totalUsers}\n`;
  text += `📊 Подписка: ${adminPremium ? '👑 Premium ∞ (Админ)' : isPremium(u) ? '💎 Premium' : '🆓 Free'}\n`;
  if (adminPremium) text += `⏰ До: ∞ Бессрочно\n`;
  else if (isPremium(u)) text += `⏰ До: ${timeLeft(u.premiumUntil)}\n`;
  else text += `🎯 Запросов: ${tokens === -1 ? '∞' : tokens + '/35'}\n`;
  
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// ─── /img ───
bot.command('img', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  if (!isPremium(u)) {
    await ctx.reply('🔒 Генерация изображений — только для Premium!\n\nПодписка: /premium');
    return;
  }
  const prompt = ctx.message.text.replace(/^\/img\s*/, '').trim();
  if (!prompt) {
    await ctx.reply('🎨 Напиши: /img котёнок в космосе');
    return;
  }
  await ctx.reply('🎨 Генерирую изображение...');
  try {
    const url = genImageUrl(prompt);
    await ctx.replyWithPhoto({ url });
  } catch (e) {
    await ctx.reply('❌ Ошибка генерации. Попробуй другой запрос.');
  }
});

// ─── /openclaw ───
bot.command('openclaw', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  if (!isPremium(u)) {
    await ctx.reply('🔒 OpenClaw — только для Premium!\n\nПодписка: /premium');
    return;
  }
  const task = ctx.message.text.replace(/^\/openclaw\s*/, '').trim();
  if (!task) {
    await ctx.reply('🦅 Напиши: /openclaw напиши приветственный текст для сайта');
    return;
  }
  await ctx.reply('🦅 OpenClaw думает...');
  try {
    const sys = 'You are OpenClaw, an autonomous AI agent. Break down the task, think step by step, and provide a complete solution. Respond in Russian.';
    const result = await aiChatWithFallback(task, sys, MODELS[0]); // GPT-4o
    await ctx.reply(result.slice(0, 4000), { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply('❌ Ошибка OpenClaw. Попробуй позже.');
  }
});

// ─── /translate ───
bot.command('translate', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  if (!useToken(u)) {
    await ctx.reply('⏰ Лимит запросов исчерпан (35/день).\n\nPremium — /premium');
    return;
  }
  const text = ctx.message.text.replace(/^\/translate\s*/, '').trim();
  if (!text) { await ctx.reply('🌐 Напиши: /translate Hello world'); return; }
  try {
    const sys = 'Translate the text to Russian. If already Russian, translate to English. Return only the translation.';
    const result = await aiChatWithFallback(text, sys, MODELS[u.modelIdx]);
    await ctx.reply(`🌐 ${result.slice(0, 4000)}`);
  } catch (e) { await ctx.reply('❌ Ошибка перевода'); }
});

// ─── /code ───
bot.command('code', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  if (!useToken(u)) {
    await ctx.reply('⏰ Лимит исчерпан. Premium — /premium');
    return;
  }
  const task = ctx.message.text.replace(/^\/code\s*/, '').trim();
  if (!task) { await ctx.reply('💻 Напиши: /code функция сортировки на Python'); return; }
  try {
    const sys = 'You are an expert programmer. Write clean, working code with comments. Respond in Russian with code blocks.';
    const result = await aiChatWithFallback(task, sys, MODELS[u.modelIdx]);
    await ctx.reply(result.slice(0, 4000), { parse_mode: 'HTML' });
  } catch (e) { await ctx.reply('❌ Ошибка'); }
});

// ─── /weather ───
bot.command('weather', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  if (!useToken(u)) {
    await ctx.reply('⏰ Лимит исчерпан. Premium — /premium');
    return;
  }
  const city = ctx.message.text.replace(/^\/weather\s*/, '').trim();
  if (!city) { await ctx.reply('🌦 Напиши: /weather Москва'); return; }
  try {
    const sys = 'You are a weather assistant. Provide realistic weather information for the city. Respond in Russian with emoji.';
    const result = await aiChatWithFallback(`Погода в городе ${city}`, sys, MODELS[u.modelIdx]);
    await ctx.reply(`🌦 ${result.slice(0, 4000)}`);
  } catch (e) { await ctx.reply('❌ Ошибка получения погоды'); }
});

// ─── /time ───
bot.command('time', async (ctx) => {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 3600000);
  await ctx.reply(`⏰ Moscow: ${msk.toISOString().replace('T', ' ').slice(0, 19)}`);
});

// ─── /dice ───
bot.command('dice', async (ctx) => {
  await ctx.reply(`🎲 ${Math.floor(Math.random() * 6) + 1}`);
});

// ─── /coin ───
bot.command('coin', async (ctx) => {
  await ctx.reply(Math.random() < 0.5 ? '🪙 Орёл!' : '🪙 Решка!');
});

// ─── /calc ───
bot.command('calc', async (ctx) => {
  const expr = ctx.message.text.replace(/^\/calc\s*/, '').trim();
  if (!expr) { await ctx.reply('🔢 Напиши: /calc 2+2*3'); return; }
  try {
    const safe = expr.replace(/[^0-9+\-*/().%\s]/g, '');
    const result = Function(`"use strict"; return (${safe})`)();
    await ctx.reply(`🔢 ${expr} = ${result}`);
  } catch { await ctx.reply('❌ Неверное выражение'); }
});

// ─── /pass ───
bot.command('pass', async (ctx) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pass = '';
  for (let i = 0; i < 16; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  await ctx.reply(`🔒 \`${pass}\``, { parse_mode: 'MarkdownV2' });
});

// ─── /uuid ───
bot.command('uuid', async (ctx) => {
  const uuid = crypto.randomUUID();
  await ctx.reply(`🆔 ${uuid}`);
});

// ─── /admin ───
bot.command('admin', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) { await ctx.reply('❌ Только для админа'); return; }
  
  let text = `🔐 <b>Админ-панель</b>\n\n`;
  text += `👥 Пользователей: ${totalUsers}\n`;
  text += `🤖 Моделей: ${MODELS.length}\n`;
  text += `👑 Ваш статус: Premium ∞\n\n`;
  text += `Команды:\n`;
  text += `/ban @username — забанить\n`;
  text += `/unban @username — разбанить\n`;
  text += `/premium @username 30 — дать Premium на 30 дней\n`;
  text += `/broadcast текст — рассылка всем\n`;
  text += `/stats — подробная статистика`;
  
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// ─── /stats ───
bot.command('stats', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return;
  
  let premium = 0, free = 0;
  for (const [, usr] of users) {
    if (isPremium(usr)) premium++; else free++;
  }
  
  let text = `📊 <b>Статистика</b>\n\n`;
  text += `Всего пользователей: ${totalUsers}\n`;
  text += `Premium: ${premium}\n`;
  text += `Free: ${free}\n`;
  text += `Моделей: ${MODELS.length}\n\n`;
  text += `<b>Последние пользователи:</b>\n`;
  let count = 0;
  for (const [, usr] of users) {
    if (count >= 10) break;
    text += `${usr.isAdmin ? '👑' : isPremium(usr) ? '💎' : '🆓'} ${usr.firstName || usr.username || usr.id}\n`;
    count++;
  }
  
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// ─── /ban ───
bot.command('ban', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return;
  const username = ctx.message.text.split(' ')[1]?.replace('@', '');
  if (!username) { await ctx.reply('Напиши: /ban @username'); return; }
  for (const [, usr] of users) {
    if (usr.username.toLowerCase() === username.toLowerCase()) {
      usr.isBanned = true;
      await ctx.reply(`✅ @${username} забанен`);
      return;
    }
  }
  await ctx.reply(`❌ @${username} не найден`);
});

// ─── /unban ───
bot.command('unban', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return;
  const username = ctx.message.text.split(' ')[1]?.replace('@', '');
  if (!username) { await ctx.reply('Напиши: /unban @username'); return; }
  for (const [, usr] of users) {
    if (usr.username.toLowerCase() === username.toLowerCase()) {
      usr.isBanned = false;
      await ctx.reply(`✅ @${username} разбанен`);
      return;
    }
  }
  await ctx.reply(`❌ @${username} не найден`);
});

// ─── /premium @username days ───
bot.command('premium', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return;
  const parts = ctx.message.text.split(' ');
  const username = parts[1]?.replace('@', '');
  const days = parseInt(parts[2] || '30');
  if (!username) { await ctx.reply('Напиши: /premium @username 30'); return; }
  for (const [, usr] of users) {
    if (usr.username.toLowerCase() === username.toLowerCase()) {
      usr.premiumUntil = Date.now() + days * 86400000;
      await ctx.reply(`✅ @${username} получил Premium на ${days} дней`);
      return;
    }
  }
  await ctx.reply(`❌ @${username} не найден`);
});

// ─── /broadcast ───
bot.command('broadcast', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return;
  const text = ctx.message.text.replace(/^\/broadcast\s*/, '').trim();
  if (!text) { await ctx.reply('Напиши: /broadcast текст сообщения'); return; }
  let sent = 0;
  for (const [id, usr] of users) {
    if (usr.isBanned) continue;
    try {
      await bot.telegram.sendMessage(id, `📢 ${text}`);
      sent++;
    } catch {}
  }
  await ctx.reply(`✅ Отправлено ${sent} пользователям`);
});

// ═══════════════════════════════════════════════
// TEXT MESSAGE HANDLER — AI CHAT
// ═══════════════════════════════════════════════
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  // Skip if it's a command
  if (text.startsWith('/')) return;
  
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (u.isBanned) return;
  
  // Check token limit
  if (!useToken(u)) {
    await ctx.reply('⏰ Лимит запросов исчерпан (35/день).\n\n💎 Premium — /premium');
    return;
  }
  
  // Quick commands
  if (text === '💬 Чат' || text === 'чат' || text === 'Chat') {
    await ctx.reply('💬 Напиши свой вопрос — я отвечу!');
    return;
  }
  if (text === '🎨 Картинка' || text === 'Картинка') {
    if (!isPremium(u)) {
      await ctx.reply('🔒 Генерация изображений — только для Premium!\n\nПодписка: /premium');
      return;
    }
    await ctx.reply('🎨 Напиши: /img описание картинки');
    return;
  }
  if (text === '🤖 Модели' || text === 'Модели') {
    ctx.message.text = '/models';
    return bot.handleUpdate(ctx.update);
  }
  if (text === '💎 Премиум' || text === 'Премиум') {
    ctx.message.text = '/premium';
    return bot.handleUpdate(ctx.update);
  }
  if (text === '📊 Профиль' || text === 'Профиль') {
    ctx.message.text = '/profile';
    return bot.handleUpdate(ctx.update);
  }
  if (text === '🔐 Админ' || text === 'Админ') {
    ctx.message.text = '/admin';
    return bot.handleUpdate(ctx.update);
  }
  if (text === '❓ Помощь' || text === 'Помощь') {
    ctx.message.text = '/help';
    return bot.handleUpdate(ctx.update);
  }
  
  // AI response
  const model = MODELS[u.modelIdx];
  const sys = `You are Aisunio, a helpful AI assistant. Respond in Russian unless asked otherwise. Be concise, friendly, and helpful. Use emoji sparingly.`;
  
  try {
    await ctx.sendChatAction('typing');
    const result = await aiChatWithFallback(text, sys, model);
    const clean = result.slice(0, 4000);
    await ctx.reply(clean, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('AI error:', e);
    await ctx.reply('❌ Ошибка AI. Попробуй другую модель: /models');
  }
});

// ═══════════════════════════════════════════════
// HEALTH CHECK SERVER
// ═══════════════════════════════════════════════
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      models: MODELS.length,
      users: totalUsers,
      uptime: process.uptime(),
    }));
  } else {
    res.writeHead(200);
    res.end('OK');
  }
});

// ═══════════════════════════════════════════════
// SELF-PING KEEP-ALIVE (prevents free tier sleep)
// ═══════════════════════════════════════════════
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.KOYEB_PUBLIC_URL || `http://localhost:${PORT}`;
setInterval(() => {
  httpsGet(SELF_URL + '/health').catch(() => {});
}, 4 * 60 * 1000); // every 4 minutes

// ═══════════════════════════════════════════════
// LAUNCH
// ═══════════════════════════════════════════════
async function launch() {
  // Delete any existing webhook (use long polling)
  try {
    await bot.telegram.deleteWebhook();
  } catch {}
  
  // Start health server
  healthServer.listen(PORT, () => {
    console.log(`Health server on :${PORT}`);
  });
  
  // Start bot
  bot.launch();
  console.log(`Bot started with ${MODELS.length} models`);
}

launch();

process.once('SIGINT', () => { bot.stop('SIGINT'); healthServer.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); healthServer.close(); });
