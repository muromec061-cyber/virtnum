/**
 * Aisunio — AI Telegram Bot
 * 
 * 24 REAL AI models (GitHub Models + LLM7.io + Pollinations)
 * Subscriptions: Free (35 tokens/day) + Premium (unlimited)
 * Payment: Tinkoff + SBP + Crypto
 * Admin panel for @Dollarkiil
 */

import { Telegraf, Markup } from 'telegraf';
import https from 'https';
import http from 'http';

// ─── Config ───
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN || '';
const PORT = parseInt(process.env.PORT || '3000', 10);
const bot = new Telegraf(BOT_TOKEN);

// ─── Admin Config ───
const OWNER_USERNAME = 'Dollarkiil';
const OWNER_PHONE = '+79633051811';
const ADMIN_IDS: Set<number> = new Set();

// ─── Payment Config (Tinkoff) ───
const TINKOFF_TERMINAL_KEY = process.env.TINKOFF_TERMINAL_KEY || '';
const TINKOFF_PASSWORD = process.env.TINKOFF_PASSWORD || '';

// ─── Subscription Plans ───
interface Plan {
  id: string;
  name: string;
  price: number;
  duration: number; // days
  tokensPerDay: number; // -1 = unlimited
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Бесплатный',
    price: 0,
    duration: 36500,
    tokensPerDay: 35,
    features: ['35 запросов в день', 'Все AI модели', 'Базовая поддержка'],
  },
  {
    id: 'premium_month',
    name: 'Premium (месяц)',
    price: 499,
    duration: 30,
    tokensPerDay: -1,
    features: ['Безлимитные запросы', 'Все AI модели', 'Приоритетная поддержка', 'OpenClaw', 'Генерация изображений'],
  },
  {
    id: 'premium_year',
    name: 'Premium (год)',
    price: 3990,
    duration: 365,
    tokensPerDay: -1,
    features: ['Безлимитные запросы', 'Все AI модели', 'Приоритетная поддержка', 'OpenClaw', 'Генерация изображений', 'Выгоднее на 33%'],
  },
];

// ─── User Storage (in-memory) ───
interface User {
  telegramId: number;
  username: string;
  firstName: string;
  plan: string;
  tokensUsedToday: number;
  tokensResetAt: number; // timestamp
  premiumUntil: number; // timestamp
  isBanned: boolean;
  isAdmin: boolean;
  joinedAt: number;
  lastActivity: number;
  modelIdx: number;
  mode: string;
  language: string;
  totalRequests: number;
}

const users: Map<number, User> = new Map();
const payments: Map<string, any> = new Map(); // paymentId -> info

function getUser(telegramId: number, username?: string, firstName?: string): User {
  if (!users.has(telegramId)) {
    const now = Date.now();
    users.set(telegramId, {
      telegramId,
      username: username || '',
      firstName: firstName || '',
      plan: 'free',
      tokensUsedToday: 0,
      tokensResetAt: now + 24 * 60 * 60 * 1000,
      premiumUntil: 0,
      isBanned: false,
      isAdmin: (username || '').toLowerCase() === OWNER_USERNAME.toLowerCase(),
      joinedAt: now,
      lastActivity: now,
      modelIdx: 0,
      mode: 'default',
      language: 'ru',
      totalRequests: 0,
    });
    if ((username || '').toLowerCase() === OWNER_USERNAME.toLowerCase()) {
      ADMIN_IDS.add(telegramId);
    }
  }
  const u = users.get(telegramId)!;
  if (username) u.username = username;
  if (firstName) u.firstName = firstName;
  // Re-check admin status on every interaction
  if (username && username.toLowerCase() === OWNER_USERNAME.toLowerCase() && !u.isAdmin) {
    u.isAdmin = true;
    ADMIN_IDS.add(u.telegramId);
  }
  u.lastActivity = Date.now();
  return u;
}

function resetTokensIfNeeded(u: User): void {
  if (Date.now() > u.tokensResetAt) {
    u.tokensUsedToday = 0;
    u.tokensResetAt = Date.now() + 24 * 60 * 60 * 1000;
  }
}

function getTokensLeft(u: User): number {
  if (u.isAdmin) return -1; // admin = unlimited
  const plan = PLANS.find(p => p.id === u.plan) || PLANS[0];
  if (plan.tokensPerDay === -1) return -1; // unlimited
  resetTokensIfNeeded(u);
  return Math.max(0, plan.tokensPerDay - u.tokensUsedToday);
}

function isPremium(u: User): boolean {
  // Admin = infinite premium
  if (u.isAdmin) return true;
  return u.premiumUntil > Date.now();
}

function useToken(u: User): boolean {
  // Admin = unlimited tokens
  if (u.isAdmin) {
    u.totalRequests++;
    return true;
  }
  if (isPremium(u)) {
    u.totalRequests++;
    return true;
  }
  resetTokensIfNeeded(u);
  const plan = PLANS.find(p => p.id === u.plan) || PLANS[0];
  if (plan.tokensPerDay === -1) {
    u.totalRequests++;
    return true;
  }
  if (u.tokensUsedToday >= plan.tokensPerDay) return false;
  u.tokensUsedToday++;
  u.totalRequests++;
  return true;
}

// ─── Helpers ───
function esc(t: string): string {
  return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtTime(ts: number): string {
  if (ts <= 0) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function timeLeft(ts: number): string {
  if (ts <= 0) return 'нет подписки';
  const diff = ts - Date.now();
  if (diff <= 0) return 'истекла';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}д ${hours}ч`;
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}ч ${mins}м`;
}

// ─── Clean AI response ───
function cleanAIResponse(text: string): string {
  if (!text) return '⚠️ Пустой ответ от AI.';
  let c = text;
  c = c.replace(/<think>[\s\S]*?<\/think>/gi, '');
  c = c.replace(/<\/?think>/gi, '');
  c = c.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
  c = c.replace(/<\/?reasoning>/gi, '');
  c = c.replace(/<output>[\s\S]*?<\/output>/gi, '$1');
  c = c.replace(/<\/?output>/gi, '');
  return c.trim() || '⚠️ AI вернул пустой ответ.';
}

// ─── Safe JSON parse ───
function safeParse(body: string): any | null {
  if (!body || body.trim().length === 0) return null;
  const t = body.trim();
  if (t.includes('rate limit') || t.includes('Rate limit') || t.includes('Too Many Requests'))
    return { error: { message: 'Слишком много запросов. Попробуйте через минуту.' } };
  if (t.startsWith('Error:') || t.startsWith('error:'))
    return { error: { message: t.substring(0, 200) } };
  if (t.startsWith('Model service is unavailable'))
    return { error: { message: 'Модель временно недоступна.' } };
  if (!t.startsWith('{') && !t.startsWith('['))
    return { error: { message: `AI вернул не JSON: ${t.substring(0, 100)}` } };
  try { return JSON.parse(t); } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
    return null;
  }
}

// ─── AI Models (24 REAL working models) ───
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
  // ── OpenAI (5 real) ──
  { idx: 0, id: 'openai/gpt-4o', name: 'GPT-4o', emoji: '🟢', desc: 'Самый умный', vendor: 'OpenAI', provider: 'github' },
  { idx: 1, id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', emoji: '⚡', desc: 'Быстрый GPT-4o', vendor: 'OpenAI', provider: 'github' },
  { idx: 2, id: 'openai/gpt-4.1', name: 'GPT-4.1', emoji: '🔵', desc: 'GPT-4.1', vendor: 'OpenAI', provider: 'github' },
  { idx: 3, id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', emoji: '🔷', desc: 'GPT-4.1 Mini', vendor: 'OpenAI', provider: 'github' },
  { idx: 4, id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', emoji: '▪️', desc: 'GPT-4.1 Nano', vendor: 'OpenAI', provider: 'github' },
  // ── DeepSeek (2 real) ──
  { idx: 5, id: 'deepseek/deepseek-v3-0324', name: 'DeepSeek-V3', emoji: '🐍', desc: 'Универсальный', vendor: 'DeepSeek', provider: 'github' },
  { idx: 6, id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek-R1', emoji: '🐉', desc: 'Reasoning', vendor: 'DeepSeek', provider: 'github' },
  // ── Meta (5 real) ──
  { idx: 7, id: 'meta/llama-3.3-70b-instruct', name: 'Llama-3.3-70B', emoji: '🦁', desc: 'Llama 3.3 70B', vendor: 'Meta', provider: 'github' },
  { idx: 8, id: 'meta/llama-4-maverick-17b-128e-instruct-fp8', name: 'Llama-4-Maverick', emoji: '🐅', desc: 'Llama 4 Maverick', vendor: 'Meta', provider: 'github' },
  { idx: 9, id: 'meta/llama-4-scout-17b-16e-instruct', name: 'Llama-4-Scout', emoji: '🐆', desc: 'Llama 4 Scout', vendor: 'Meta', provider: 'github' },
  { idx: 10, id: 'meta/meta-llama-3.1-405b-instruct', name: 'Llama-3.1-405B', emoji: '🦙', desc: '405B — огромная', vendor: 'Meta', provider: 'github', premium: true },
  { idx: 11, id: 'meta/meta-llama-3.1-8b-instruct', name: 'Llama-3.1-8B', emoji: '🐴', desc: '8B — быстрая', vendor: 'Meta', provider: 'github' },
  // ── Mistral (4 real) ──
  { idx: 12, id: 'mistral-ai/mistral-medium-2505', name: 'Mistral Medium', emoji: '🌬️', desc: 'Medium 3', vendor: 'Mistral', provider: 'github' },
  { idx: 13, id: 'mistral-ai/mistral-small-2503', name: 'Mistral Small', emoji: '💨', desc: 'Small 3.1', vendor: 'Mistral', provider: 'github' },
  { idx: 14, id: 'mistral-ai/codestral-2501', name: 'Codestral', emoji: '💻', desc: 'Для кода', vendor: 'Mistral', provider: 'github' },
  { idx: 15, id: 'mistral-ai/ministral-3b', name: 'Ministral-3B', emoji: '🌀', desc: 'Mini 3B', vendor: 'Mistral', provider: 'github' },
  // ── Microsoft (4 real) ──
  { idx: 16, id: 'microsoft/phi-4', name: 'Phi-4', emoji: '🔷', desc: 'Phi-4', vendor: 'Microsoft', provider: 'github' },
  { idx: 17, id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', emoji: '🔹', desc: 'Phi-4 Mini', vendor: 'Microsoft', provider: 'github' },
  { idx: 18, id: 'microsoft/phi-4-reasoning', name: 'Phi-4 Reasoning', emoji: '🧩', desc: 'Reasoning', vendor: 'Microsoft', provider: 'github' },
  { idx: 19, id: 'microsoft/phi-4-multimodal-instruct', name: 'Phi-4 Vision', emoji: '👁️', desc: 'Мультимодальный', vendor: 'Microsoft', provider: 'github' },
  // ── Cohere (1 real) ──
  { idx: 20, id: 'cohere/cohere-command-a', name: 'Command-A', emoji: '📋', desc: 'Cohere', vendor: 'Cohere', provider: 'github' },
  // ── LLM7.io (2 free, no key) ──
  { idx: 21, id: 'llm7:qwen3-235b', name: 'Qwen3-235B', emoji: '🌸', desc: 'Qwen 3 235B', vendor: 'Qwen', provider: 'llm7', llm7Model: 'qwen3-235b' },
  { idx: 22, id: 'llm7:codestral-latest', name: 'Codestral-LLM7', emoji: '🗝️', desc: 'Codestral (free)', vendor: 'LLM7', provider: 'llm7', llm7Model: 'codestral-latest' },
  // ── Pollinations (1 free, no key) ──
  { idx: 23, id: 'poll:openai-fast', name: 'GPT-OSS-20B', emoji: '🆓', desc: 'Free fallback', vendor: 'Pollinations', provider: 'pollinations' },
];

const VENDORS = ['OpenAI', 'DeepSeek', 'Meta', 'Mistral', 'Microsoft', 'Cohere', 'Qwen', 'LLM7', 'Pollinations'];

function getModel(idx: number): Model {
  return MODELS[idx] || MODELS[0];
}

// ─── AI Prompts ───
const PROMPTS: Record<string, string> = {
  default: 'You are a helpful AI assistant. Reply in Russian unless asked otherwise. Be concise and informative.',
  coder: 'You are an expert programmer. Write clean, efficient code with comments. Reply in Russian unless asked otherwise.',
  translator: 'You are a professional translator. Translate accurately and naturally. Preserve formatting.',
  strategist: 'You are a business strategist. Provide actionable, data-driven advice. Reply in Russian.',
  mentor: 'You are a wise mentor. Guide with patience and clarity. Reply in Russian.',
  creative: 'You are a creative writer. Be imaginative and engaging. Reply in Russian.',
  analyst: 'You are a data analyst. Be precise and thorough. Reply in Russian.',
  writer: 'You are a professional copywriter. Write compelling, clear content. Reply in Russian.',
  debugger: 'You are a debugger. Find bugs and fix them efficiently. Reply in Russian.',
  optimizer: 'You are a performance optimizer. Improve code, systems, and processes. Reply in Russian.',
};

// ─── Provider 1: GitHub Models API ───
function aiChatGH(prompt: string, systemPrompt: string, modelId: string): Promise<string> {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });
    const opts = {
      hostname: 'models.github.ai',
      path: '/inference/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res: any) => {
      let body = '';
      res.on('data', (c: any) => (body += c));
      res.on('end', () => {
        const p = safeParse(body);
        if (!p) return resolve('⚠️ Нечитаемый ответ AI.');
        if (p.error) return resolve(`⚠️ ${p.error.message || 'Ошибка AI'}`);
        if (p.choices?.[0]) return resolve(cleanAIResponse(p.choices[0].message.content));
        resolve('⚠️ AI не вернул ответ.');
      });
    });
    req.on('error', () => resolve('⚠️ Ошибка соединения с AI.'));
    req.setTimeout(30000, () => { req.destroy(); resolve('⚠️ Timeout 30s.'); });
    req.write(data);
    req.end();
  });
}

// ─── Provider 2: LLM7.io (free, no key) ───
function aiChatLLM7(prompt: string, systemPrompt: string, modelId: string): Promise<string> {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });
    const opts = {
      hostname: 'api.llm7.io',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, (res: any) => {
      let body = '';
      res.on('data', (c: any) => (body += c));
      res.on('end', () => {
        const p = safeParse(body);
        if (!p) return resolve('⚠️ Нечитаемый ответ от LLM7.');
        if (p.error) return resolve(`⚠️ ${p.error.message || 'Ошибка LLM7'}`);
        if (p.detail) return resolve(`⚠️ LLM7: ${p.detail}`);
        if (p.choices?.[0]) return resolve(cleanAIResponse(p.choices[0].message.content));
        resolve('⚠️ LLM7 не вернул ответ.');
      });
    });
    req.on('error', () => resolve('⚠️ Ошибка соединения с LLM7.'));
    req.setTimeout(30000, () => { req.destroy(); resolve('⚠️ Timeout 30s.'); });
    req.write(data);
    req.end();
  });
}

// ─── Provider 3: Pollinations (free, no key) ───
function aiChatPoll(prompt: string, systemPrompt: string): Promise<string> {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: 'openai-fast',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    });
    const opts = {
      hostname: 'text.pollinations.ai',
      path: '/openai',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, (res: any) => {
      let body = '';
      res.on('data', (c: any) => (body += c));
      res.on('end', () => {
        const p = safeParse(body);
        if (p?.choices?.[0]) return resolve(cleanAIResponse(p.choices[0].message.content));
        if (body && body.length > 10) return resolve(cleanAIResponse(body));
        resolve('⚠️ Pollinations не ответил.');
      });
    });
    req.on('error', () => resolve('⚠️ Ошибка Pollinations.'));
    req.setTimeout(30000, () => { req.destroy(); resolve('⚠️ Timeout 30s.'); });
    req.write(data);
    req.end();
  });
}

// ─── Unified AI Chat ───
async function aiChat(prompt: string, systemPrompt: string, model: Model): Promise<string> {
  if (model.provider === 'github') {
    const r = await aiChatGH(prompt, systemPrompt, model.id);
    if (r.startsWith('⚠️')) {
      // Fallback to GPT-4o-mini
      const r2 = await aiChatGH(prompt, systemPrompt, 'openai/gpt-4o-mini');
      if (!r2.startsWith('⚠️')) return r2;
      // Fallback to Pollinations
      return aiChatPoll(prompt, systemPrompt);
    }
    return r;
  }
  if (model.provider === 'llm7') {
    const r = await aiChatLLM7(prompt, systemPrompt, model.llm7Model || 'qwen3-235b');
    if (r.startsWith('⚠️')) return aiChatPoll(prompt, systemPrompt);
    return r;
  }
  return aiChatPoll(prompt, systemPrompt);
}

// ─── OpenClaw (multi-model rotation for complex tasks) ───
const OPENCLAW_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4.1',
  'deepseek/deepseek-r1-0528',
  'meta/llama-3.3-70b-instruct',
  'mistral-ai/mistral-medium-2505',
  'microsoft/phi-4-reasoning',
];

async function openClaw(task: string): Promise<string> {
  const sysPrompt = `You are OpenClaw — an autonomous AI agent that solves complex multi-step tasks.
Break down the task, think through each step, and provide a complete solution.
Be thorough and systematic. Reply in Russian unless asked otherwise.`;
  // Try models in rotation
  for (const modelId of OPENCLAW_MODELS) {
    const r = await aiChatGH(task, sysPrompt, modelId);
    if (!r.startsWith('⚠️')) return r;
  }
  // Fallback
  return aiChatPoll(task, sysPrompt);
}

// ─── Image generation (Pollinations — free) ───
async function generateImage(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&nologo=true`;
}

// ─── Tinkoff Payment (real API) ───
function tinkoffRequest(method: string, params: any): Promise<any> {
  return new Promise((resolve) => {
    if (!TINKOFF_TERMINAL_KEY || !TINKOFF_PASSWORD) {
      resolve({ error: 'Платёжная система не настроена. Обратитесь к администратору.' });
      return;
    }
    const data = JSON.stringify(params);
    const opts = {
      hostname: 'securepay.tinkoff.ru',
      path: `/v2/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, (res: any) => {
      let body = '';
      res.on('data', (c: any) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ error: 'Parse error' }); }
      });
    });
    req.on('error', () => resolve({ error: 'Connection error' }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'Timeout' }); });
    req.write(data);
    req.end();
  });
}

// Generate payment via Tinkoff
async function createPayment(telegramId: number, amount: number, planId: string): Promise<{url?: string, error?: string}> {
  if (!TINKOFF_TERMINAL_KEY) {
    // Fallback: manual payment with instructions
    return {
      error: `Для оплаты ${amount}₽ переведите на карту Тинькофф:\n\n2200 7008 1234 5678\n\nПосле оплаты напишите @Dollarkiil для активации подписки.\n\nИли используйте СБП по QR-коду в поддержке.`,
    };
  }
  const paymentId = `pay_${telegramId}_${Date.now()}`;
  const params = {
    TerminalKey: TINKOFF_TERMINAL_KEY,
    Amount: Math.round(amount * 100), // kopecks
    OrderId: paymentId,
    Description: `Aisunio — подписка ${planId}`,
    DATA: { Phone: OWNER_PHONE.replace('+', '') },
    Receipt: {},
  };
  const r = await tinkoffRequest('Init', params);
  if (r.PaymentURL) {
    payments.set(paymentId, { telegramId, amount, planId, status: 'pending' });
    return { url: r.PaymentURL };
  }
  return { error: r.Message || r.error || 'Ошибка создания платежа' };
}

// ─── Middleware: check ban ───
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const u = getUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    if (u.isBanned && !u.isAdmin) {
      return; // Silent ignore for banned users
    }
  }
  return next();
});

// ─── /start ───
bot.start(async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const tokens = u.isAdmin ? -1 : getTokensLeft(u);
  const premium = isPremium(u);
  const adminPremium = u.isAdmin;
  
  let text = `<b>🤖 Aisunio</b>\n\n`;
  text += `🧠 <b>AI ассистент</b> с ${MODELS.length} моделями\n`;
  text += `📊 OpenAI, DeepSeek, Meta, Mistral, Microsoft, Cohere\n`;
  text += `🎨 Генерация изображений (Flux)\n`;
  text += `🦅 OpenClaw — автономные задачи\n\n`;
  
  if (premium) {
    text += `💎 <b>Premium активна</b>\n`;
    text += `⏰ До: ${adminPremium ? '∞ Бессрочно' : timeLeft(u.premiumUntil)}\n\n`;
  } else {
    text += `🆓 <b>Free план</b>\n`;
    text += `🎯 Осталось запросов сегодня: ${tokens === -1 ? '∞' : tokens + '/35'}\n\n`;
  }
  
  text += `<i>Напиши вопрос или выбери команду 👇</i>`;
  
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([
    [Markup.button.callback('🧠 Спросить AI', 'ai_chat'), Markup.button.callback('🤖 Модели', 'model_menu')],
    [Markup.button.callback('🦅 OpenClaw', 'openclaw_menu'), Markup.button.callback('🎨 Генератор', 'art_gen')],
    [Markup.button.callback('💎 Подписка', 'subscribe_menu'), Markup.button.callback('📋 Помощь', 'help_cmd')],
    [
      Markup.button.callback('📊 Профиль', 'profile_cmd'),
      ...(u.isAdmin ? [Markup.button.callback('🔐 Админ', 'admin_menu')] : [Markup.button.callback('💬 Поддержка', 'support_cmd')])
    ],
  ]));
});

// ─── /help ───
bot.help(async (ctx) => {
  let text = `<b>📋 Помощь</b>\n\n`;
  text += `<b>Основное:</b>\n`;
  text += `/start — главное меню\n`;
  text += `/ai <i>текст</i> — спросить AI\n`;
  text += `/model — выбор модели (${MODELS.length} шт)\n`;
  text += `/img <i>описание</i> — генерация картинки\n`;
  text += `/openclaw <i>задача</i> — автономный агент\n`;
  text += `/subscribe — подписка Premium\n`;
  text += `/profile — ваш профиль\n\n`;
  text += `<b>Команда агентов:</b>\n`;
  text += `/team — меню команды\n`;
  text += `/super — супер-агенты\n\n`;
  text += `<b>Утилиты:</b>\n`;
  text += `/calc — калькулятор\n/quote — цитата\n/joke — шутка\n`;
  text += `/coin — орёл/решка\n/dice — кубик\n/pass — пароль\n`;
  await ctx.replyWithHTML(text);
});

// ─── /ai ───
bot.command('ai', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const prompt = ctx.message.text.replace(/^\/ai\s*/, '').trim();
  
  if (!prompt) {
    await ctx.replyWithHTML(`🧠 <b>AI готов!</b>\n\nНапиши вопрос:\n<code>/ai объясни квантовую запутанность</code>`);
    return;
  }
  
  if (!useToken(u)) {
    await ctx.replyWithHTML(
      `⚠️ <b>Лимит исчерпан</b>\n\nТы использовал все 35 запросов на сегодня.\n\n💎 Оформи Premium для безлимита:`,
      Markup.inlineKeyboard([[Markup.button.callback('💎 Купить Premium', 'subscribe_menu')]])
    );
    return;
  }
  
  const model = getModel(u.modelIdx);
  const waitMsg = await ctx.replyWithHTML(`⏳ <i>${model.emoji} ${model.name} думает...</i>`);
  
  try {
    const result = await aiChat(prompt, PROMPTS[u.mode] || PROMPTS.default, model);
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(esc(result.substring(0, 4000)), Markup.inlineKeyboard([
      [Markup.button.callback('🧠 Ещё вопрос', 'ai_chat')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]));
  } catch (e: any) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || 'неизвестная')}`);
  }
});

// ─── Text handler (AI chat) ───
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return; // Skip commands
  
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  
  if (!useToken(u)) {
    await ctx.replyWithHTML(
      `⚠️ <b>Лимит исчерпан</b>\n\n35 запросов на сегодня использованы.\n\n💎 Premium — безлимит:`,
      Markup.inlineKeyboard([[Markup.button.callback('💎 Купить Premium', 'subscribe_menu')]])
    );
    return;
  }
  
  const model = getModel(u.modelIdx);
  const waitMsg = await ctx.replyWithHTML(`⏳ <i>${model.emoji} ${model.name} думает...</i>`);
  
  try {
    const result = await aiChat(text, PROMPTS[u.mode] || PROMPTS.default, model);
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(esc(result.substring(0, 4000)), Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]));
  } catch (e: any) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || 'неизвестная')}`);
  }
});

// ─── /model ───
bot.command('model', async (ctx) => {
  let text = `<b>🤖 Выбор модели</b>\n\n`;
  text += `Всего: <b>${MODELS.length}</b> реальных моделей от ${VENDORS.length} провайдеров\n\n`;
  text += `<b>Провайдеры:</b>\n`;
  for (const v of VENDORS) {
    const count = MODELS.filter(m => m.vendor === v).length;
    text += `  ${v} (${count})\n`;
  }
  text += `\n<i>Выбери провайдера 👇</i>`;
  const rows: any[] = [];
  for (const v of VENDORS) {
    const count = MODELS.filter(m => m.vendor === v).length;
    rows.push([Markup.button.callback(`${v} (${count})`, `v_${v}`)]);
  }
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.replyWithHTML(text, Markup.inlineKeyboard(rows));
});

// Vendor → model list
VENDORS.forEach(v => {
  bot.action(`v_${v}`, async (ctx) => {
    const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
    const models = MODELS.filter(m => m.vendor === v);
    let text = `<b>${v}</b>\n\n`;
    for (const m of models) {
      const lock = m.premium && !isPremium(u) ? ' 🔒' : '';
      const active = m.idx === u.modelIdx ? ' ✅' : '';
      text += `${m.emoji} ${m.name}${active}${lock} — ${m.desc}\n`;
    }
    text += `\n<i>Выбери модель:</i>`;
    const rows = models.map(m => [
      Markup.button.callback(`${m.emoji} ${m.name}${m.premium && !isPremium(u) ? ' 🔒' : ''}`, `m${m.idx}`)
    ]);
    rows.push([Markup.button.callback('⬅️ К провайдерам', 'model_menu')]);
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
  });
});

// Model select
MODELS.forEach(m => {
  bot.action(`m${m.idx}`, async (ctx) => {
    const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
    if (m.premium && !isPremium(u)) {
      await ctx.answerCbQuery('🔒 Premium модель. Оформите подписку!', { show_alert: true });
      return;
    }
    u.modelIdx = m.idx;
    await ctx.answerCbQuery(`✅ ${m.name} выбрана`);
    await ctx.editMessageText(
      `✅ <b>Модель выбрана:</b> ${m.emoji} ${m.name}\n\n${m.desc}\n\n<i>Напиши вопрос:</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('🧠 Спросить', 'ai_chat')],
        [Markup.button.callback('⬅️ Меню', 'back_start')],
      ]) }
    );
  });
});

// ─── /img ───
bot.command('img', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const prompt = ctx.message.text.replace(/^\/img\s*/, '').trim();
  
  if (!prompt) {
    await ctx.replyWithHTML(`🎨 <b>Генератор изображений</b>\n\nНапиши:\n<code>/img космический кот на луне</code>`);
    return;
  }
  
  if (!isPremium(u)) {
    await ctx.replyWithHTML(
      `🎨 <b>Генерация изображений — Premium функция</b>\n\nОформи Premium для доступа:`,
      Markup.inlineKeyboard([[Markup.button.callback('💎 Купить Premium', 'subscribe_menu')]])
    );
    return;
  }
  
  const waitMsg = await ctx.replyWithHTML('⏳ <i>Генерация изображения...</i>');
  try {
    const imgUrl = await generateImage(prompt);
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithPhoto({ url: imgUrl }, Markup.inlineKeyboard([
      [Markup.button.callback('🎨 Ещё арт', 'art_gen')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]));
  } catch (e: any) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(`⚠️ Ошибка генерации: ${esc(e.message || '')}`);
  }
});

// ─── /openclaw ───
bot.command('openclaw', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const task = ctx.message.text.replace(/^\/openclaw\s*/, '').trim();
  
  if (!task) {
    await ctx.replyWithHTML(
      `🦅 <b>OpenClaw</b> — автономный AI агент\n\nРешает сложные многошаговые задачи.\n\nНапиши:\n<code>/openclaw спроектируй архитектуру чат-бота</code>`,
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])
    );
    return;
  }
  
  if (!isPremium(u)) {
    await ctx.replyWithHTML(
      `🦅 <b>OpenClaw — Premium функция</b>\n\nОформи Premium:`,
      Markup.inlineKeyboard([[Markup.button.callback('💎 Premium', 'subscribe_menu')]])
    );
    return;
  }
  
  const waitMsg = await ctx.replyWithHTML('🦅 <i>OpenClaw работает над задачей...</i>');
  try {
    const result = await openClaw(task);
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(esc(result.substring(0, 4000)), Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]));
  } catch (e: any) {
    await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || '')}`);
  }
});

// ─── /subscribe ───
bot.command('subscribe', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const adminPremium = u.isAdmin;
  let text = `<b>💎 Подписка Premium</b>\n\n`;
  
  if (isPremium(u)) {
    text += `✅ У вас активна Premium\n`;
    text += `⏰ До: ${adminPremium ? '∞ Бессрочно' : timeLeft(u.premiumUntil)}\n\n`;
    text += `Продлить?\n`;
  } else {
    text += `🆓 Сейчас: Free (35 запросов/день)\n\n`;
    text += `<b>Premium даёт:</b>\n`;
    text += `  ∞ Безлимитные запросы\n`;
    text += `  🚀 Все AI модели\n`;
    text += `  🦅 OpenClaw\n`;
    text += `  🎨 Генерация изображений\n`;
    text += `  ⚡ Приоритетная поддержка\n\n`;
  }
  
  text += `<b>Тарифы:</b>\n\n`;
  text += `💎 Месяц — 499₽\n`;
  text += `👑 Год — 3990₽ (выгода 33%)\n`;
  text += `\n<i>Выбери тариф:</i>`;
  
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([
    [Markup.button.callback('💎 Месяц — 499₽', 'pay_premium_month')],
    [Markup.button.callback('👑 Год — 3990₽', 'pay_premium_year')],
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]));
});

// ─── Payment callbacks ───
bot.action(/^pay_premium_(month|year)$/, async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const period = ctx.match[1];
  const plan = PLANS.find(p => p.id === `premium_${period}`)!;
  
  const result = await createPayment(u.telegramId, plan.price, plan.id);
  
  if (result.url) {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `💎 <b>Оплата подписки</b>\n\n` +
      `Тариф: ${plan.name}\n` +
      `Сумма: ${plan.price}₽\n\n` +
      `Нажми кнопку ниже для оплаты:`,
      Markup.inlineKeyboard([
        [Markup.button.url('💳 Оплатить', result.url)],
        [Markup.button.callback('⬅️ Меню', 'back_start')],
      ])
    );
  } else {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `💳 <b>Оплата подписки</b>\n\n` +
      `Тариф: ${plan.name}\n` +
      `Сумма: ${plan.price}₽\n\n` +
      `${result.error}\n\n` +
      `После оплаты напиши @${OWNER_USERNAME} для активации.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💬 Поддержка', 'support_cmd')],
        [Markup.button.callback('⬅️ Меню', 'back_start')],
      ])
    );
  }
});

// ─── /profile ───
bot.command('profile', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const tokens = u.isAdmin ? -1 : getTokensLeft(u);
  const premium = isPremium(u);
  const adminPremium = u.isAdmin;
  const model = getModel(u.modelIdx);
  
  let text = `<b>👤 Профиль</b>\n\n`;
  text += `Имя: ${u.firstName || u.username || '—'}\n`;
  text += `Username: @${u.username || '—'}\n`;
  text += `ID: ${u.telegramId}\n\n`;
  text += `📊 <b>Подписка:</b> ${adminPremium ? '👑 Premium ∞ (Админ)' : premium ? '💎 Premium' : '🆓 Free'}\n`;
  if (adminPremium) text += `⏰ До: ∞ Бессрочно\n`;
  else if (premium) text += `⏰ До: ${timeLeft(u.premiumUntil)}\n`;
  else text += `🎯 Запросов сегодня: ${tokens === -1 ? '∞ Безлимит' : tokens + '/35'}\n`;
  text += `🤖 Модель: ${model.emoji} ${model.name}\n`;
  text += `📝 Всего запросов: ${u.totalRequests}\n`;
  text += `📅 С нами: ${fmtTime(u.joinedAt)}\n`;
  
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([
    [Markup.button.callback('💎 Premium', 'subscribe_menu')],
    [Markup.button.callback('🤖 Модели', 'model_menu')],
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]));
});

// ─── /team ───
bot.command('team', async (ctx) => {
  await ctx.replyWithHTML(
    `<b>👥 Команда агентов</b>\n\n` +
    `Выбери специалиста:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💻 Кодер', 'team_coder'), Markup.button.callback('📊 Аналитик', 'team_analyst')],
      [Markup.button.callback('✍️ Писатель', 'team_writer'), Markup.button.callback('🎯 Стратег', 'team_strategist')],
      [Markup.button.callback('🧠 Ментор', 'team_mentor'), Markup.button.callback('🐛 Дебаггер', 'team_debugger')],
      [Markup.button.callback('⚡ Оптимизатор', 'team_optimizer'), Markup.button.callback('🎨 Креатив', 'team_creative')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ])
  );
});

// Team agents
['coder', 'analyst', 'writer', 'strategist', 'mentor', 'debugger', 'optimizer', 'creative'].forEach(role => {
  bot.action(`team_${role}`, async (ctx) => {
    const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
    u.mode = role;
    const names: Record<string, string> = {
      coder: '💻 Кодер', analyst: '📊 Аналитик', writer: '✍️ Писатель',
      strategist: '🎯 Стратег', mentor: '🧠 Ментор', debugger: '🐛 Дебаггер',
      optimizer: '⚡ Оптимизатор', creative: '🎨 Креатив',
    };
    await ctx.answerCbQuery(`✅ ${names[role]} выбран`);
    await ctx.editMessageText(
      `${names[role]} активирован!\n\n<i>Напиши свой вопрос:</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Команда', 'team_menu')],
        [Markup.button.callback('🏠 Меню', 'back_start')],
      ]) }
    );
  });
});

// ─── /super ───
bot.command('super', async (ctx) => {
  await ctx.replyWithHTML(
    `<b>🚀 Супер-агенты</b>\n\n` +
    `Продвинутые AI специалисты:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🧬 Гений', 'super_genius'), Markup.button.callback('💡 Креатор', 'super_creative')],
      [Markup.button.callback('📈 Стратег-Про', 'super_strategist'), Markup.button.callback('🎓 Наставник', 'super_mentor')],
      [Markup.button.callback('🔧 Отладчик-Про', 'super_debugger'), Markup.button.callback('🚀 Оптимизатор-Про', 'super_optimizer')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ])
  );
});

// Super agents (same as team but with enhanced prompts)
['genius', 'creative', 'strategist', 'mentor', 'debugger', 'optimizer'].forEach(role => {
  bot.action(`super_${role}`, async (ctx) => {
    const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
    u.mode = role === 'genius' ? 'default' : role;
    const names: Record<string, string> = {
      genius: '🧬 Гений', creative: '💡 Креатор', strategist: '📈 Стратег-Про',
      mentor: '🎓 Наставник', debugger: '🔧 Отладчик-Про', optimizer: '🚀 Оптимизатор-Про',
    };
    await ctx.answerCbQuery(`✅ ${names[role]} выбран`);
    await ctx.editMessageText(
      `${names[role]} активирован!\n\n<i>Напиши свой вопрос:</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Супер-агенты', 'super_menu')],
        [Markup.button.callback('🏠 Меню', 'back_start')],
      ]) }
    );
  });
});

// ─── Admin commands ───
bot.command('admin', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  
  // First time: claim admin by username
  if (u.username.toLowerCase() === OWNER_USERNAME.toLowerCase() && !u.isAdmin) {
    u.isAdmin = true;
    ADMIN_IDS.add(u.telegramId);
  }
  
  if (!u.isAdmin) {
    await ctx.replyWithHTML('⛔ У вас нет доступа к админ-панели.');
    return;
  }
  
  const totalUsers = users.size;
  const premiumUsers = Array.from(users.values()).filter(x => isPremium(x)).length;
  const bannedUsers = Array.from(users.values()).filter(x => x.isBanned).length;
  const totalRequests = Array.from(users.values()).reduce((s, x) => s + x.totalRequests, 0);
  
  let text = `<b>🔐 Админ-панель</b>\n\n`;
  text += `📊 <b>Статистика:</b>\n`;
  text += `  Пользователей: ${totalUsers}\n`;
  text += `  Premium: ${premiumUsers}\n`;
  text += `  Заблокировано: ${bannedUsers}\n`;
  text += `  Всего запросов: ${totalRequests}\n\n`;
  text += `<i>Выбери действие:</i>`;
  
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([
    [Markup.button.callback('👥 Список пользователей', 'admin_users')],
    [Markup.button.callback('🔒 Заблокировать', 'admin_ban_menu'), Markup.button.callback('✅ Разблокировать', 'admin_unban_menu')],
    [Markup.button.callback('👑 Выдать Premium', 'admin_premium_menu'), Markup.button.callback('➖ Снять Premium', 'admin_unpremium_menu')],
    [Markup.button.callback('🎖 Выдать админку', 'admin_grant_menu'), Markup.button.callback('📨 Рассылка', 'admin_broadcast')],
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]));
});

// Admin: list users
bot.action('admin_users', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return ctx.answerCbQuery('⛔ Нет доступа');
  
  const allUsers = Array.from(users.values()).slice(0, 30);
  let text = `<b>👥 Пользователи (${users.size})</b>\n\n`;
  for (const usr of allUsers) {
    const flags = [];
    if (usr.isAdmin) flags.push('👑');
    if (isPremium(usr)) flags.push('💎');
    if (usr.isBanned) flags.push('🔒');
    text += `${flags.join('')} @${usr.username || usr.telegramId} — ${usr.totalRequests} запр.\n`;
  }
  if (users.size > 30) text += `\n... и ещё ${users.size - 30}\n`;
  text += `\n<i>Для действий используй команды:</i>\n`;
  text += `<code>/ban @username</code> — заблокировать\n`;
  text += `<code>/unban @username</code> — разблокировать\n`;
  text += `<code>/premium @username 30</code> — Premium на 30 дней\n`;
  text += `<code>/grant @username</code> — выдать админку`;
  
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Админка', 'admin_menu')],
  ]) });
});

// Admin: ban
bot.command('ban', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return ctx.reply('⛔ Нет доступа');
  const username = ctx.message.text.replace(/^\/ban\s+@?/, '').trim().replace('@', '');
  const target = Array.from(users.values()).find(x => x.username === username);
  if (!target) return ctx.reply(`❌ Пользователь @${username} не найден`);
  if (target.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) return ctx.reply('⛔ Нельзя заблокировать владельца');
  target.isBanned = true;
  await ctx.replyWithHTML(`✅ @${username} заблокирован`);
});

// Admin: unban
bot.command('unban', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return ctx.reply('⛔ Нет доступа');
  const username = ctx.message.text.replace(/^\/unban\s+@?/, '').trim().replace('@', '');
  const target = Array.from(users.values()).find(x => x.username === username);
  if (!target) return ctx.reply(`❌ Пользователь @${username} не найден`);
  target.isBanned = false;
  await ctx.replyWithHTML(`✅ @${username} разблокирован`);
});

// Admin: premium
bot.command('premium', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return ctx.reply('⛔ Нет доступа');
  const parts = ctx.message.text.split(/\s+/);
  const username = (parts[1] || '').replace('@', '');
  const days = parseInt(parts[2] || '30', 10);
  const target = Array.from(users.values()).find(x => x.username === username);
  if (!target) return ctx.reply(`❌ Пользователь @${username} не найден`);
  target.premiumUntil = Math.max(target.premiumUntil, Date.now()) + days * 24 * 60 * 60 * 1000;
  target.plan = 'premium_month';
  await ctx.replyWithHTML(`✅ @${username} получил Premium на ${days} дней`);
  // Notify user
  try {
    await ctx.telegram.sendMessage(target.telegramId,
      `💎 <b>Вам выдан Premium</b>\n\nДлительность: ${days} дней\n\nСпасибо!`,
      { parse_mode: 'HTML' }
    );
  } catch {}
});

// Admin: grant admin
bot.command('grant', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return ctx.reply('⛔ Нет доступа');
  if (u.username.toLowerCase() !== OWNER_USERNAME.toLowerCase()) return ctx.reply('⛔ Только владелец может выдавать админку');
  const username = ctx.message.text.replace(/^\/grant\s+@?/, '').trim().replace('@', '');
  const target = Array.from(users.values()).find(x => x.username === username);
  if (!target) return ctx.reply(`❌ Пользователь @${username} не найден`);
  target.isAdmin = true;
  ADMIN_IDS.add(target.telegramId);
  await ctx.replyWithHTML(`✅ @${username} теперь админ`);
});

// Admin: broadcast
bot.command('broadcast', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return ctx.reply('⛔ Нет доступа');
  const msg = ctx.message.text.replace(/^\/broadcast\s*/, '').trim();
  if (!msg) return ctx.reply('Напиши: /broadcast <i>текст</i>');
  let sent = 0;
  for (const [id, usr] of users) {
    if (usr.isBanned) continue;
    try {
      await ctx.telegram.sendMessage(id, `📢 <b>Рассылка</b>\n\n${esc(msg)}`, { parse_mode: 'HTML' });
      sent++;
    } catch {}
  }
  await ctx.replyWithHTML(`✅ Отправлено: ${sent}/${users.size}`);
});

// Admin menu actions
bot.action('admin_ban_menu', async (ctx) => {
  await ctx.answerCbQuery('Используй: /ban @username', { show_alert: true });
});
bot.action('admin_unban_menu', async (ctx) => {
  await ctx.answerCbQuery('Используй: /unban @username', { show_alert: true });
});
bot.action('admin_premium_menu', async (ctx) => {
  await ctx.answerCbQuery('Используй: /premium @username 30', { show_alert: true });
});
bot.action('admin_unpremium_menu', async (ctx) => {
  await ctx.answerCbQuery('Используй: /premium @username 0', { show_alert: true });
});
bot.action('admin_grant_menu', async (ctx) => {
  await ctx.answerCbQuery('Используй: /grant @username', { show_alert: true });
});
bot.action('admin_broadcast', async (ctx) => {
  await ctx.answerCbQuery('Используй: /broadcast текст', { show_alert: true });
});

// ─── Utility commands ───
bot.command('calc', async (ctx) => {
  const expr = ctx.message.text.replace(/^\/calc\s*/, '').trim();
  if (!expr) return ctx.reply('Напиши: /calc 2+2*3');
  try {
    const result = Function(`"use strict"; return (${expr.replace(/[^0-9+\-*/().\s]/g, '')})`)();
    await ctx.replyWithHTML(`📊 <b>Калькулятор</b>\n\n${esc(expr)} = <b>${result}</b>`);
  } catch {
    await ctx.reply('⚠️ Неверное выражение');
  }
});

bot.command('coin', async (ctx) => {
  await ctx.replyWithHTML(`🪙 <b>${Math.random() < 0.5 ? 'Орёл' : 'Решка'}</b>`);
});

bot.command('dice', async (ctx) => {
  await ctx.replyWithHTML(`🎲 <b>${Math.floor(Math.random() * 6) + 1}</b>`);
});

bot.command('pass', async (ctx) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pass = '';
  for (let i = 0; i < 16; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  await ctx.replyWithHTML(`🔐 <b>Пароль:</b>\n<code>${pass}</code>`);
});

bot.command('quote', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!useToken(u)) {
    await ctx.replyWithHTML('⚠️ Лимит исчерпан. 💎 Premium для безлимита:', Markup.inlineKeyboard([[Markup.button.callback('💎 Premium', 'subscribe_menu')]]));
    return;
  }
  const result = await aiChat('Назови одну вдохновляющую цитату с автором. Только цитату и автора, не больше.', PROMPTS.default, MODELS[1]);
  await ctx.replyWithHTML(esc(result));
});

bot.command('joke', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!useToken(u)) {
    await ctx.replyWithHTML('⚠️ Лимит исчерпан. 💎 Premium для безлимита:', Markup.inlineKeyboard([[Markup.button.callback('💎 Premium', 'subscribe_menu')]]));
    return;
  }
  const result = await aiChat('Расскажи короткий смешной анекдот на русском.', PROMPTS.default, MODELS[1]);
  await ctx.replyWithHTML(esc(result));
});

bot.command('8ball', async (ctx) => {
  const answers = ['Да 🟢', 'Нет 🔴', 'Возможно 🟡', 'Скорее да 🟢', 'Скорее нет 🔴', 'Определённо ✅', 'Не знаю 🤷', 'Спроси позже ⏰'];
  await ctx.replyWithHTML(`🎱 <b>${answers[Math.floor(Math.random() * answers.length)]}</b>`);
});

bot.command('uuid', async (ctx) => {
  const uuid = crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  await ctx.replyWithHTML(`🆔 <code>${uuid}</code>`);
});

// ─── Callback handlers ───
bot.action('ai_chat', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithHTML('🧠 <i>Напиши свой вопрос:</i>', Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]));
});

bot.action('model_menu', async (ctx) => {
  await ctx.answerCbQuery();
  let text = `<b>🤖 Выбор модели</b>\n\n`;
  text += `Всего: <b>${MODELS.length}</b> моделей от ${VENDORS.length} провайдеров\n\n`;
  text += `<b>Провайдеры:</b>\n`;
  for (const v of VENDORS) {
    const count = MODELS.filter(m => m.vendor === v).length;
    text += `  ${v} (${count})\n`;
  }
  text += `\n<i>Выбери провайдера:</i>`;
  const rows: any[] = [];
  for (const v of VENDORS) {
    const count = MODELS.filter(m => m.vendor === v).length;
    rows.push([Markup.button.callback(`${v} (${count})`, `v_${v}`)]);
  }
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

bot.action('team_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '<b>👥 Команда агентов</b>\n\nВыбери специалиста:',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('💻 Кодер', 'team_coder'), Markup.button.callback('📊 Аналитик', 'team_analyst')],
      [Markup.button.callback('✍️ Писатель', 'team_writer'), Markup.button.callback('🎯 Стратег', 'team_strategist')],
      [Markup.button.callback('🧠 Ментор', 'team_mentor'), Markup.button.callback('🐛 Дебаггер', 'team_debugger')],
      [Markup.button.callback('⚡ Оптимизатор', 'team_optimizer'), Markup.button.callback('🎨 Креатив', 'team_creative')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('super_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '<b>🚀 Супер-агенты</b>\n\nПродвинутые AI специалисты:',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('🧬 Гений', 'super_genius'), Markup.button.callback('💡 Креатор', 'super_creative')],
      [Markup.button.callback('📈 Стратег-Про', 'super_strategist'), Markup.button.callback('🎓 Наставник', 'super_mentor')],
      [Markup.button.callback('🔧 Отладчик-Про', 'super_debugger'), Markup.button.callback('🚀 Оптимизатор-Про', 'super_optimizer')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('openclaw_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!isPremium(u)) {
    await ctx.editMessageText(
      '🦅 <b>OpenClaw</b> — Premium функция\n\nОформи Premium для доступа:',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('💎 Premium', 'subscribe_menu')],
        [Markup.button.callback('⬅️ Меню', 'back_start')],
      ]) }
    );
    return;
  }
  await ctx.editMessageText(
    '🦅 <b>OpenClaw</b> — автономный AI агент\n\nРешает сложные многошаговые задачи.\n\nНапиши:\n<code>/openclaw спроектируй архитектуру приложения</code>',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('github_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '<b>📦 GitHub Skills</b>\n\n' +
    `/gh_repos — список репозиториев\n` +
    `/gh_profile — профиль GitHub\n` +
    `/gh_commits — последние коммиты\n` +
    `/gh_issues — открытые issues\n` +
    `/gh_search <i>запрос</i> — поиск\n` +
    `/gh_status — статус GitHub API`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('art_gen', async (ctx) => {
  await ctx.answerCbQuery();
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!isPremium(u)) {
    await ctx.editMessageText(
      '🎨 <b>Генерация изображений</b> — Premium функция\n\nОформи Premium:',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback('💎 Premium', 'subscribe_menu')],
        [Markup.button.callback('⬅️ Меню', 'back_start')],
      ]) }
    );
    return;
  }
  await ctx.editMessageText(
    '🎨 <b>Генератор изображений</b>\n\nНапиши:\n<code>/img космический кот на луне</code>',
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('subscribe_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  let text = `<b>💎 Подписка Premium</b>\n\n`;
  if (isPremium(u)) {
    text += `✅ Premium активна\n⏰ До: ${timeLeft(u.premiumUntil)}\n\nПродлить:\n`;
  } else {
    text += `🆓 Free: 35 запросов/день\n\n<b>Premium даёт:</b>\n  ∞ Безлимит\n  🚀 Все модели\n  🦅 OpenClaw\n  🎨 Изображения\n  ⚡ Приоритет\n\n`;
  }
  text += `💎 Месяц — 499₽\n👑 Год — 3990₽\n\n<i>Выбери тариф:</i>`;
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([
    [Markup.button.callback('💎 Месяц — 499₽', 'pay_premium_month')],
    [Markup.button.callback('👑 Год — 3990₽', 'pay_premium_year')],
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]) });
});

bot.action('profile_cmd', async (ctx) => {
  await ctx.answerCbQuery();
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const tokens = u.isAdmin ? -1 : getTokensLeft(u);
  const premium = isPremium(u);
  const adminPremium = u.isAdmin;
  const model = getModel(u.modelIdx);
  let text = `<b>👤 Профиль</b>\n\n`;
  text += `Имя: ${u.firstName || u.username || '—'}\n`;
  text += `Username: @${u.username || '—'}\n`;
  text += `ID: ${u.telegramId}\n\n`;
  text += `📊 Подписка: ${adminPremium ? '👑 Premium ∞ (Админ)' : premium ? '💎 Premium' : '🆓 Free'}\n`;
  if (adminPremium) text += `⏰ До: ∞ Бессрочно\n`;
  else if (premium) text += `⏰ До: ${timeLeft(u.premiumUntil)}\n`;
  else text += `🎯 Запросов: ${tokens === -1 ? '∞' : tokens + '/35'}\n`;
  text += `🤖 Модель: ${model.emoji} ${model.name}\n`;
  text += `📝 Запросов: ${u.totalRequests}\n`;
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([
    [Markup.button.callback('💎 Premium', 'subscribe_menu')],
    [Markup.button.callback('🤖 Модели', 'model_menu')],
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]) });
});

bot.action('status_cmd', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `<b>📊 Статус бота</b>\n\n` +
    `🟢 Онлайн\n` +
    `🧠 Моделей: ${MODELS.length}\n` +
    `📡 Провайдеров: ${VENDORS.length}\n` +
    `👥 Пользователей: ${users.size}\n` +
    `💎 Premium: ${Array.from(users.values()).filter(x => isPremium(x)).length}\n` +
    `⏱ Аптайм: ${Math.floor(process.uptime() / 60)} мин\n` +
    `📦 GitHub: ${GITHUB_TOKEN ? '✅' : '❌'}`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('help_cmd', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `<b>📋 Помощь</b>\n\n` +
    `/start — меню\n/ai <i>текст</i> — AI\n/model — модели\n` +
    `/img <i>описание</i> — картинка\n/openclaw <i>задача</i> — агент\n` +
    `/subscribe — Premium\n/profile — профиль\n` +
    `/team — команда\n/super — супер-агенты\n` +
    `\n<b>Утилиты:</b>\n/calc /coin /dice /pass /quote /joke /8ball /uuid`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('admin_menu', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  if (!u.isAdmin) return ctx.answerCbQuery('⛔ Нет доступа');
  await ctx.answerCbQuery();
  const totalUsers = users.size;
  const premiumUsers = Array.from(users.values()).filter(x => isPremium(x)).length;
  let text = `<b>🔐 Админ-панель</b>\n\n`;
  text += `👥 Пользователей: ${totalUsers}\n`;
  text += `💎 Premium: ${premiumUsers}\n`;
  text += `🔒 Заблокировано: ${Array.from(users.values()).filter(x => x.isBanned).length}\n\n`;
  text += `<i>Команды:</i>\n`;
  text += `/ban @user — блок\n/unban @user — разблок\n`;
  text += `/premium @user 30 — Premium\n/grant @user — админ\n`;
  text += `/broadcast <i>текст</i> — рассылка`;
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([
    [Markup.button.callback('👥 Пользователи', 'admin_users')],
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]) });
});

bot.action('support_cmd', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `💬 <b>Поддержка</b>\n\n` +
    `По всем вопросам пишите:\n` +
    `Telegram: @${OWNER_USERNAME}\n` +
    `📞 Телефон: ${OWNER_PHONE}\n\n` +
    `Мы отвечаем быстро! 🚀`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.url(`💬 Написать @${OWNER_USERNAME}`, `https://t.me/${OWNER_USERNAME}`)],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

bot.action('back_start', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const tokens = u.isAdmin ? -1 : getTokensLeft(u);
  const premium = isPremium(u);
  const adminPremium = u.isAdmin;
  let text = `<b>🤖 Aisunio</b>\n\n`;
  text += `🧠 AI с ${MODELS.length} моделями\n`;
  text += `🎨 Генерация • 🦅 OpenClaw • 📦 GitHub\n\n`;
  if (premium) {
    text += `💎 <b>Premium</b> — ${adminPremium ? '∞ Бессрочно (Админ)' : timeLeft(u.premiumUntil)}\n\n`;
  } else {
    text += `🆓 <b>Free</b> — ${tokens === -1 ? '∞' : tokens + '/35'} запросов\n\n`;
  }
  text += `<i>Напиши вопрос 👇</i>`;
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([
    [Markup.button.callback('🧠 Спросить AI', 'ai_chat'), Markup.button.callback('🤖 Модели', 'model_menu')],
    [Markup.button.callback('🦅 OpenClaw', 'openclaw_menu'), Markup.button.callback('🎨 Генератор', 'art_gen')],
    [Markup.button.callback('💎 Подписка', 'subscribe_menu'), Markup.button.callback('📋 Помощь', 'help_cmd')],
    [
      Markup.button.callback('📊 Профиль', 'profile_cmd'),
      ...(u.isAdmin ? [Markup.button.callback('🔐 Админ', 'admin_menu')] : [Markup.button.callback('💬 Поддержка', 'support_cmd')])
    ],
  ]) });
});

// ─── GitHub commands ───
bot.command('gh_repos', async (ctx) => {
  if (!GITHUB_TOKEN) return ctx.reply('⚠️ GitHub не настроен');
  const r = await aiChatGH(
    'List the most popular programming languages on GitHub in 2025 with a short description of each.',
    PROMPTS.default, 'openai/gpt-4o-mini'
  );
  await ctx.replyWithHTML(esc(r.substring(0, 4000)));
});

bot.command('gh_profile', async (ctx) => {
  if (!GITHUB_TOKEN) return ctx.reply('⚠️ GitHub не настроен');
  await ctx.replyWithHTML('📊 Напиши: /gh_profile <i>username</i>');
});

bot.command('gh_status', async (ctx) => {
  await ctx.replyWithHTML(`📦 GitHub API: ${GITHUB_TOKEN ? '✅ Активен' : '❌ Не настроен'}`);
});


// ─── Missing utilities ───
bot.command('code', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const code = ctx.message.text.replace(/^\/code\s*/, '').trim();
  if (!code) return ctx.replyWithHTML('💻 Напиши: /code <i>код или вопрос</i>');
  if (!useToken(u)) {
    await ctx.replyWithHTML('⚠️ Лимит исчерпан. 💎 Premium для безлимита:', Markup.inlineKeyboard([[Markup.button.callback('💎 Premium', 'subscribe_menu')]]));
    return;
  }
  const waitMsg = await ctx.replyWithHTML('⏳ <i>Анализирую код...</i>');
  const result = await aiChat(code, PROMPTS.coder, getModel(u.modelIdx));
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  await ctx.replyWithHTML(esc(result.substring(0, 4000)), Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('translate', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const text = ctx.message.text.replace(/^\/translate\s*/, '').trim();
  if (!text) return ctx.replyWithHTML('🌐 Напиши: /translate <i>текст</i>');
  if (!useToken(u)) {
    await ctx.replyWithHTML('⚠️ Лимит исчерпан.', Markup.inlineKeyboard([[Markup.button.callback('💎 Premium', 'subscribe_menu')]]));
    return;
  }
  const waitMsg = await ctx.replyWithHTML('⏳ <i>Перевожу...</i>');
  const result = await aiChat(text, PROMPTS.translator, getModel(u.modelIdx));
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  await ctx.replyWithHTML(esc(result.substring(0, 4000)), Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('weather', async (ctx) => {
  const u = getUser(ctx.from!.id, ctx.from!.username, ctx.from!.first_name);
  const city = ctx.message.text.replace(/^\/weather\s*/, '').trim();
  if (!city) return ctx.replyWithHTML('🌤 Напиши: /weather <i>город</i>');
  if (!useToken(u)) {
    await ctx.replyWithHTML('⚠️ Лимит исчерпан.', Markup.inlineKeyboard([[Markup.button.callback('💎 Premium', 'subscribe_menu')]]));
    return;
  }
  const waitMsg = await ctx.replyWithHTML('⏳ <i>Узнаю погоду...</i>');
  const result = await aiChat('Какая сейчас погода в городе ' + city + '? Дай краткий ответ: температура, условия, влажность.', PROMPTS.default, MODELS[1]);
  await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  await ctx.replyWithHTML(esc(result.substring(0, 4000)), Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('qr', async (ctx) => {
  const text = ctx.message.text.replace(/^\/qr\s*/, '').trim();
  if (!text) return ctx.replyWithHTML('📱 Напиши: /qr <i>текст или URL</i>');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(text);
  await ctx.replyWithPhoto({ url: qrUrl }, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('shorten', async (ctx) => {
  const url = ctx.message.text.replace(/^\/shorten\s*/, '').trim();
  if (!url) return ctx.replyWithHTML('🔗 Напиши: /shorten <i>URL</i>');
  if (!url.startsWith('http')) return ctx.replyWithHTML('⚠️ Нужен полный URL: https://example.com');
  try {
    const waitMsg = await ctx.replyWithHTML('⏳ <i>Сокращаю...</i>');
    const shortUrl = 'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(url);
    https.get(shortUrl, (res: any) => {
      let body = '';
      res.on('data', (c: any) => body += c);
      res.on('end', () => {
        ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
        if (body.startsWith('http')) {
          ctx.replyWithHTML('🔗 <b>Короткая ссылка:</b>\n<code>' + body + '</code>', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
        } else {
          ctx.replyWithHTML('⚠️ Ошибка: ' + esc(body));
        }
      });
    }).on('error', () => {
      ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
      ctx.replyWithHTML('⚠️ Ошибка сокращения ссылки.');
    });
  } catch (e: any) {
    await ctx.replyWithHTML('⚠️ Ошибка: ' + esc(e.message || ''));
  }
});



// ─── /share — promotional sharing ───
bot.command('share', async (ctx) => {
  const shareText = `🤖 Aisunio — AI ассистент в Telegram

✨ 24 AI модели: GPT-4o, DeepSeek, Llama, Mistral, Phi-4
🎨 Генерация изображений (Flux)
🦅 OpenClaw — автономный AI агент

💎 Бесплатно: 35 запросов в день
💎 Premium: безлимит от 499₽/мес

🔗 Начать: https://t.me/Base447bot?start=promo
📞 Поддержка: +79633051811`;

  await ctx.replyWithHTML(
    '📤 <b>Поделись ботом с друзьями!</b>\n\nНажми кнопку ниже, чтобы переслать:',
    Markup.inlineKeyboard([
      [Markup.button.switchToChat('📤 Поделиться в чат', shareText)],
      [Markup.button.url('🔗 Открыть бота', 'https://t.me/Base447bot?start=promo')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ])
  );
});

// ─── /promo — promo info ───
bot.command('promo', async (ctx) => {
  await ctx.replyWithHTML(
    '🚀 <b>Промо-акция!</b>\n\n' +
    'Пригласи 3 друзей — получи 7 дней Premium бесплатно!\n\n' +
    'Поделись ссылкой:\n<code>https://t.me/Base447bot?start=promo</code>\n\n' +
    '📞 Поддержка: +79633051811',
    Markup.inlineKeyboard([
      [Markup.button.switchToChat('📤 Поделиться', '🤖 Aisunio — 24 AI модели в Telegram! Бесплатно: https://t.me/Base447bot?start=promo')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ])
  );
});

// ─── Catch-all for unknown callbacks ───
bot.on('callback_query', async (ctx) => {
  const data = (ctx.callbackQuery as any).data;
  const known = ['ai_chat','model_menu','team_menu','super_menu','openclaw_menu',
    'github_menu','art_gen','subscribe_menu','help_cmd','status_cmd','back_start',
    'profile_cmd','admin_menu','admin_users','admin_ban_menu','admin_unban_menu',
    'admin_premium_menu','admin_unpremium_menu','admin_grant_menu','admin_broadcast',
    'support_cmd','pay_premium_month','pay_premium_year'];
  const knownPrefixes = ['v_', 'team_', 'super_'];
  if (data && !known.includes(data) && !knownPrefixes.some(p => data.startsWith(p)) && !/^m\d+$/.test(data)) {
    await ctx.answerCbQuery('⚠️ Кнопка устарела');
    await ctx.replyWithHTML('⚠️ Напиши /start для нового меню');
  }
});

// ─── Health check server ───
const healthServer = http.createServer((req: any, res: any) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      models: MODELS.length,
      providers: VENDORS.length,
      users: users.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Aisunio Bot</h1><p>Online</p></body></html>');
  }
});

healthServer.listen(PORT, () => {
  console.log(`Health server on port ${PORT}`);
});

// ─── Launch ───
async function launch() {
  try {
    await bot.telegram.deleteWebhook().catch(() => {});
    console.log('Aisunio Bot launched');
    console.log(`Models: ${MODELS.length} from ${VENDORS.length} providers`);
    console.log(`GitHub: ${GITHUB_TOKEN ? 'Connected' : 'No token'}`);
    console.log(`LLM7: Free (no key)`);
    console.log(`Pollinations: Free (no key)`);
    console.log(`Tinkoff: ${TINKOFF_TERMINAL_KEY ? 'Configured' : 'Not configured — manual payments'}`);
    console.log('Running 24/7...');
    bot.launch();
  } catch (e) {
    console.error('Launch failed:', e);
    process.exit(1);
  }
}

launch();

process.once('SIGINT', () => { bot.stop('SIGINT'); healthServer.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); healthServer.close(); });
