/**
 * Aisunio — AI Super Agent Bot v5.1
 * 
 * Multi-Model AI: GPT-4o/5, DeepSeek, Llama-4, Mistral, Phi-4, Claude-mode
 * Image Generation: Flux, Sana (Pollinations)
 * OpenClaw Agent: Autonomous task execution
 * GitHub Skills: Repo management, issues, PRs, code search
 * Powered by GitHub Models API (free, unlimited with GitHub token) + Pollinations AI
 * Runs 24/7 in long polling mode
 */

import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import https from 'https';

// ─── Config ───
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN || '';
const bot = new Telegraf(BOT_TOKEN);

// ─── Helpers ───
const div = '━━━━━━━━━━━━━━━━━━━';
const tdiv = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─';

function esc(t: string): string {
  return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Clean AI response (fix for DeepSeek-R1 ild tags and HTML issues) ───
function cleanAIResponse(text: string): string {
  if (!text) return '⚠️ Пустой ответ от AI.';
  // Remove DeepSeek reasoning tags
  let cleaned = text.replace(/<think>/g, '').replace(/<\/think>/g, '');
  cleaned = cleaned.replace(/^ild\s*/g, '').replace(/ILD\s*$/g, '');
  cleaned = cleaned.replace(/^\s*ild\s*\n/gi, '');
  // Remove reasoning prefixes that some models add
  cleaned = cleaned.replace(/^Okay,? so /i, '');
  // Trim excessive whitespace
  cleaned = cleaned.trim();
  return cleaned || '⚠️ AI вернул пустой ответ.';
}

// ─── Safe JSON parse (fix for "Too many requests" non-JSON responses) ───
function safeParse(body: string): any | null {
  if (!body || body.trim().length === 0) return null;
  // Check if response is plain text (rate limit, error page, etc.)
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // Plain text error — return a structured error
    if (trimmed.includes('Too many requests') || trimmed.includes('rate limit')) {
      return { error: { message: 'Rate limit. Попробуйте через минуту.' } };
    }
    return { error: { message: `AI вернул не-JSON: ${trimmed.substring(0, 100)}` } };
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to extract JSON from mixed content
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

// ─── AI Models ───
interface Model {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  tier: 'high' | 'low' | 'custom';
  fallback?: string;
  isClaude?: boolean;
}

const MODELS: Model[] = [
  // OpenAI
  { id: 'openai/gpt-4o', name: 'GPT-4o', emoji: '🟢', desc: 'GPT-4o — самый умный', tier: 'high', fallback: 'openai' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', emoji: '⚡', desc: 'Быстрый GPT-4o', tier: 'low', fallback: 'openai' },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', emoji: '🔵', desc: 'GPT-4.1 — топ для кода', tier: 'high' },
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', emoji: '🔷', desc: 'Быстрый GPT-4.1', tier: 'low' },
  { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', emoji: '🔹', desc: 'Сверхбыстрый', tier: 'low' },
  { id: 'openai/gpt-5', name: 'GPT-5', emoji: '🧠', desc: 'GPT-5 — новейшая', tier: 'custom' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', emoji: '🧩', desc: 'GPT-5 Mini', tier: 'custom' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', emoji: '🟣', desc: 'GPT-5 Nano', tier: 'custom' },
  { id: 'openai/o3', name: 'o3', emoji: '🎯', desc: 'o3 — reasoning', tier: 'custom' },
  { id: 'openai/o4-mini', name: 'o4-mini', emoji: '🎲', desc: 'o4-mini reasoning', tier: 'custom' },
  // DeepSeek
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek-R1', emoji: '🐉', desc: 'DeepSeek R1 — reasoning', tier: 'low' },
  { id: 'deepseek/deepseek-v3-0324', name: 'DeepSeek-V3', emoji: '🐲', desc: 'DeepSeek V3', tier: 'low' },
  // Meta
  { id: 'meta/llama-3.3-70b-instruct', name: 'Llama-3.3-70B', emoji: '🦙', desc: 'Llama 3.3 70B', tier: 'low' },
  { id: 'meta/llama-4-scout-17b-16e-instruct', name: 'Llama-4-Scout', emoji: '🦁', desc: 'Llama 4 Scout', tier: 'low' },
  { id: 'meta/llama-4-maverick-17b-128e-instruct-fp8', name: 'Llama-4-Maverick', emoji: '🐅', desc: 'Llama 4 Maverick', tier: 'low' },
  // Mistral
  { id: 'mistral-ai/mistral-medium-2505', name: 'Mistral Medium', emoji: '🌬️', desc: 'Mistral Medium 3', tier: 'low' },
  { id: 'mistral-ai/mistral-small-2503', name: 'Mistral Small', emoji: '💨', desc: 'Mistral Small 3.1', tier: 'low' },
  { id: 'mistral-ai/codestral-2501', name: 'Codestral', emoji: '💻', desc: 'Codestral — для кода', tier: 'low' },
  // Microsoft
  { id: 'microsoft/phi-4', name: 'Phi-4', emoji: '🔷', desc: 'Phi-4', tier: 'low' },
  { id: 'microsoft/phi-4-reasoning', name: 'Phi-4 Reasoning', emoji: '🟦', desc: 'Phi-4 reasoning', tier: 'low' },
  // Cohere
  { id: 'cohere/cohere-command-a', name: 'Command-A', emoji: '📋', desc: 'Cohere Command A', tier: 'low' },
  // Claude (simulated via GPT-4o with Claude personality)
  { id: 'claude-sonnet', name: 'Claude Sonnet', emoji: '🎭', desc: 'Claude Sonnet 4 (режим)', tier: 'high', fallback: 'openai', isClaude: true },
  { id: 'claude-opus', name: 'Claude Opus', emoji: '🎭', desc: 'Claude Opus 4 (режим)', tier: 'high', fallback: 'openai', isClaude: true },
  { id: 'claude-haiku', name: 'Claude Haiku', emoji: '🎭', desc: 'Claude Haiku (режим)', tier: 'low', fallback: 'openai', isClaude: true },
];

// Image models
const IMAGE_MODELS = [
  { id: 'flux', name: 'Flux', emoji: '🎨', desc: 'Flux — высокое качество' },
  { id: 'sana', name: 'Sana', emoji: '🖌️', desc: 'Sana — быстрая генерация' },
  { id: 'turbo', name: 'Turbo', emoji: '⚡', desc: 'Turbo — сверхбыстро' },
];

// ─── GitHub Skills ───
const GITHUB_SKILLS = [
  { id: 'repo', name: '📦 Repos', desc: 'Список твоих GitHub репозиториев', cmd: '/gh_repos' },
  { id: 'issues', name: '🐛 Issues', desc: 'Создать и просмотреть issues', cmd: '/gh_issues' },
  { id: 'pulls', name: '🔀 Pull Requests', desc: 'PR и merge запросы', cmd: '/gh_prs' },
  { id: 'commits', name: '📝 Commits', desc: 'История коммитов', cmd: '/gh_commits' },
  { id: 'search', name: '🔍 Code Search', desc: 'Поиск кода по GitHub', cmd: '/gh_search' },
  { id: 'branches', name: '🌿 Branches', desc: 'Ветки репозитория', cmd: '/gh_branches' },
  { id: 'releases', name: '🏷️ Releases', desc: 'Релизы и версии', cmd: '/gh_releases' },
  { id: 'skill_create', name: '🛠️ Skill Create', desc: 'Создать новый файл в репо', cmd: '/skill_create' },
  { id: 'gh_status', name: '📊 GitHub Status', desc: 'Статус GitHub сервисов', cmd: '/gh_status' },
  { id: 'user_info', name: '👤 Profile', desc: 'Инфо о GitHub профиле', cmd: '/gh_profile' },
];

// ─── Claude System Prompts ───
const CLAUDE_PROMPTS: Record<string, string> = {
  'claude-sonnet': 'You are Claude Sonnet 4, made by Anthropic. You are helpful, harmless, and honest. You think step by step and give thoughtful, nuanced answers. You have a warm but professional tone. Reply in Russian unless asked otherwise. Use emoji occasionally.',
  'claude-opus': 'You are Claude Opus 4, Anthropic\'s most capable model. You excel at complex reasoning, coding, and analysis. You are thoughtful, precise, and comprehensive. Reply in Russian unless asked otherwise. Use emoji occasionally.',
  'claude-haiku': 'You are Claude Haiku, a fast and efficient model by Anthropic. You give quick, clear answers. Reply in Russian unless asked otherwise. Use emoji occasionally.',
};

// ─── AI Engine: GitHub Models API (with retry + better error handling) ───
async function aiChatGH(prompt: string, systemPrompt: string, modelId: string): Promise<string> {
  return new Promise((resolve) => {
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    const data = JSON.stringify({
      model: modelId,
      messages,
      max_tokens: 4000,
      temperature: 0.7,
    });

    const options = {
      hostname: 'models.github.ai',
      path: '/inference/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res: any) => {
      let body = '';
      res.on('data', (c: any) => body += c);
      res.on('end', () => {
        const parsed = safeParse(body);
        if (!parsed) {
          resolve('⚠️ AI вернул нечитаемый ответ. Попробуйте /model и выберите другую модель.');
          return;
        }
        if (parsed.error) {
          resolve(`⚠️ ${parsed.error.message || 'Ошибка AI'}`);
          return;
        }
        if (parsed.choices && parsed.choices[0]) {
          const content = parsed.choices[0].message.content;
          resolve(cleanAIResponse(content));
          return;
        }
        resolve('⚠️ AI не вернул ответ. Попробуйте другую модель через /model');
      });
    });
    req.on('error', () => resolve('⚠️ Ошибка соединения с AI.'));
    req.setTimeout(30000, () => {
      req.destroy();
      resolve('⚠️ AI timeout — попробуйте /model и выберите другую модель.');
    });
    req.write(data);
    req.end();
  });
}

// ─── AI Engine: Pollinations (free fallback) ───
async function aiChatPoll(prompt: string, systemPrompt: string): Promise<string> {
  return new Promise((resolve) => {
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];
    const data = JSON.stringify({ messages, model: 'openai' });
    const options = {
      hostname: 'text.pollinations.ai',
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(options, (res: any) => {
      let body = '';
      res.on('data', (c: any) => body += c);
      res.on('end', () => resolve(cleanAIResponse(body)));
    });
    req.on('error', () => resolve('⚠️ Ошибка соединения с AI.'));
    req.setTimeout(15000, () => { req.destroy(); resolve('⚠️ AI timeout.'); });
    req.write(data);
    req.end();
  });
}

// ─── Unified AI Chat (with retry + Claude mode + fallback) ───
async function aiChat(prompt: string, systemPrompt: string, modelId?: string): Promise<string> {
  const model = MODELS.find(m => m.id === modelId) || MODELS[0];

  // Claude mode — use GPT-4o with Claude personality
  if (model.isClaude) {
    const claudePrompt = CLAUDE_PROMPTS[model.id] || CLAUDE_PROMPTS['claude-sonnet'];
    const combined = `${claudePrompt}\n\n${systemPrompt}`;
    if (GITHUB_TOKEN) {
      const result = await aiChatGH(prompt, combined, 'openai/gpt-4o');
      if (!result.startsWith('⚠️')) return result;
      // Fallback to Pollinations
      return aiChatPoll(prompt, combined);
    }
    return aiChatPoll(prompt, combined);
  }

  // Normal models — GitHub Models API
  if (GITHUB_TOKEN) {
    const result = await aiChatGH(prompt, systemPrompt, model.id);
    if (!result.startsWith('⚠️')) return result;

    // Auto-fallback to GPT-4o-mini if main model fails
    if (model.id !== 'openai/gpt-4o-mini') {
      const retry = await aiChatGH(prompt, systemPrompt, 'openai/gpt-4o-mini');
      if (!retry.startsWith('⚠️')) return `⚠️ Модель ${model.name} временно недоступна. Ответ от GPT-4o Mini:\n\n${retry}`;
    }

    // Last resort: Pollinations
    if (model.fallback) {
      const pollResult = await aiChatPoll(prompt, systemPrompt);
      if (!pollResult.startsWith('⚠️')) return pollResult;
    }

    return result;
  }

  return aiChatPoll(prompt, systemPrompt);
}

// ─── GitHub API helper ───
function ghAPI(path: string, method: string = 'GET', body?: any): Promise<any> {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const options: any = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Aisunio-Bot',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res: any) => {
      let respBody = '';
      res.on('data', (c: any) => respBody += c);
      res.on('end', () => {
        try { resolve(JSON.parse(respBody)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    if (data) req.write(data);
    req.end();
  });
}

// ─── Image Generation ───
async function aiImage(prompt: string, model: string = 'flux'): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&model=${model}&nologo=true&seed=${Math.floor(Math.random()*999999)}`;
}

// ─── System Prompts ───
const PROMPTS: Record<string, string> = {
  default: 'You are Aisunio, a friendly AI assistant. Reply in Russian unless asked otherwise. Be concise but helpful. Use emoji occasionally.',
  coder: 'You are an expert programmer. Write clean, working code. Explain briefly. Reply in Russian.',
  creative: 'You are a creative writer. Generate engaging content. Reply in Russian.',
  strategist: 'You are a business strategist. Give practical, actionable advice. Reply in Russian.',
  translator: 'You are a translator. Translate the given text. If text is in English, translate to Russian. If in Russian, translate to English.',
  analyst: 'You are a data analyst. Analyze and explain clearly. Reply in Russian.',
  mentor: 'You are a wise mentor. Explain complex things simply. Reply in Russian.',
  devops: 'You are a DevOps engineer. Give practical infrastructure advice. Reply in Russian.',
  security: 'You are a security expert. Identify vulnerabilities and suggest fixes. Reply in Russian.',
  seo: 'You are an SEO specialist. Optimize content for search engines. Reply in Russian.',
  openclaw: 'You are OpenClaw, an autonomous AI agent. You can plan multi-step tasks, write code, analyze problems, and execute solutions. Be thorough and systematic. Break down complex tasks into steps. Reply in Russian.',
};

// ─── Agents (Team) ───
const AI_AGENTS = [
  { id: 'architect', name: '🏗️ Архитектор', emoji: '🏗️', desc: 'Проектирует структуру проектов', prompt: 'You are a software architect. Design clean project structures. Reply in Russian.' },
  { id: 'coder', name: '💻 Кодер', emoji: '💻', desc: 'Пишет чистый код, находит баги', prompt: PROMPTS.coder },
  { id: 'designer', name: '🎨 Дизайнер', emoji: '🎨', desc: 'UI/UX, цвета, шрифты', prompt: 'You are a UI/UX designer. Give design advice. Reply in Russian.' },
  { id: 'analyst', name: '📊 Аналитик', emoji: '📊', desc: 'Анализ данных, отчёты', prompt: PROMPTS.analyst },
  { id: 'writer', name: '✍️ Копирайтер', emoji: '✍️', desc: 'Тексты, статьи, посты', prompt: PROMPTS.creative },
  { id: 'devops', name: '⚙️ DevOps', emoji: '⚙️', desc: 'Деплой, CI/CD, серверы', prompt: PROMPTS.devops },
  { id: 'security', name: '🛡️ Безопасность', emoji: '🛡️', desc: 'Аудит, уязвимости', prompt: PROMPTS.security },
  { id: 'seo', name: '🔍 SEO', emoji: '🔍', desc: 'Оптимизация, ключевые слова', prompt: PROMPTS.seo },
];

// ─── Super Agents ───
const SUPER_AGENTS = [
  { id: 'genius', name: '🧠 Гений', desc: 'Решает любые задачи', power: 100, prompt: PROMPTS.default },
  { id: 'creative', name: '🎭 Творец', desc: 'Генерирует идеи, сценарии', power: 95, prompt: PROMPTS.creative },
  { id: 'strategist', name: '♟️ Стратег', desc: 'Долгосрочные планы', power: 98, prompt: PROMPTS.strategist },
  { id: 'mentor', name: '🎓 Ментор', desc: 'Объясняет сложное просто', power: 90, prompt: PROMPTS.mentor },
  { id: 'debugger', name: '🐞 Дебаггер', desc: 'Находит и исправляет ошибки', power: 97, prompt: 'You are a debugger. Find and fix bugs in code. Reply in Russian.' },
  { id: 'optimizer', name: '⚡ Оптимизатор', desc: 'Ускоряет код и процессы', power: 93, prompt: 'You are a performance optimizer. Reply in Russian.' },
];

// ─── OpenClaw Agent ───
const OPENCLAW_INFO = {
  name: '🦅 OpenClaw',
  desc: 'Автономный AI агент — выполняет сложные многошаговые задачи',
  capabilities: [
    '📋 Планирование задач',
    '💻 Написание и выполнение кода',
    '🔍 Анализ и исследование',
    '📝 Создание контента',
    '🏗️ Проектирование архитектуры',
    '🔧 Отладка и оптимизация',
  ],
  prompt: PROMPTS.openclaw,
};

// ─── User sessions ───
const userSessions: Map<number, { mode: string; agent: string; model: string; imageModel: string; }> = new Map();

function getSession(userId: number) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { mode: 'ai', agent: 'default', model: 'openai/gpt-4o', imageModel: 'flux' });
  }
  return userSessions.get(userId)!;
}

// ═══════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════

// ─── /start ───
bot.start(async (ctx) => {
  const name = ctx.from?.first_name || 'друг';
  userSessions.set(ctx.from!.id, { mode: 'ai', agent: 'default', model: 'openai/gpt-4o', imageModel: 'flux' });

  const text = `
<b>👋 Привет, ${esc(name)}!</b>

${div}

<b>🤖 Aisunio v5.1</b> — AI Super Agent
⚡ ${MODELS.length} AI моделей • OpenClaw • GitHub Skills
🆕 Claude режимы • Flux/Sana • Исправленный AI

${tdiv}

<b>Что я умею:</b>
🧠 GPT-4o/5, DeepSeek, Llama-4, Mistral, Phi-4
🎭 Claude Sonnet/Opus/Haiku (режим)
🦅 OpenClaw — автономный агент
📦 GitHub: репо, issues, PR, коммиты
🎨 Flux / Sana — генерация картинок
👥 8 AI-агентов команды
🚀 6 супер-агентов
🛠️ GitHub Skills — управление кодом

${tdiv}

<i>Выбери 👇</i>`;

  await ctx.replyWithHTML(text, Markup.inlineKeyboard([
    [Markup.button.callback('🧠 Спросить AI', 'ai_chat'), Markup.button.callback('🤖 Выбор модели', 'model_menu')],
    [Markup.button.callback('👥 Команда', 'team_menu'), Markup.button.callback('🚀 Супер-агенты', 'super_menu')],
    [Markup.button.callback('🦅 OpenClaw', 'openclaw_menu'), Markup.button.callback('📦 GitHub Skills', 'github_menu')],
    [Markup.button.callback('🎨 Генератор артов', 'art_gen'), Markup.button.callback('🎭 Claude', 'claude_menu')],
    [Markup.button.callback('📋 Все команды', 'help_cmd'), Markup.button.callback('📊 Статус', 'status_cmd')],
  ]));
});

// ─── /ai ───
bot.command('ai', async (ctx) => {
  const input = ctx.message.text.replace('/ai', '').trim();
  const session = getSession(ctx.from!.id);
  session.mode = 'ai';

  if (!input) {
    const model = MODELS.find(m => m.id === session.model) || MODELS[0];
    await ctx.replyWithHTML(
      `<b>🧠 AI режим активирован!</b>\n\n${div}\n\n<b>Модель:</b> ${model.emoji} ${model.name}\n\nПиши вопросы — отвечу через AI.\n\n${tdiv}\n\n<b>Команды:</b>\n/ai &lt;вопрос&gt; — быстрый вопрос\n/code &lt;задача&gt; — генератор кода\n/translate &lt;текст&gt; — переводчик\n/img &lt;описание&gt; — картинки\n/model — выбор AI модели\n/openclaw &lt;задача&gt; — автономный агент\n\n<i>Пиши 👇</i>`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🤖 Сменить модель', 'model_menu')],
        [Markup.button.callback('⬅️ Меню', 'back_start')]
      ])
    );
    return;
  }

  await ctx.replyWithHTML('🧠 <i>Думаю...</i>');
  const response = await aiChat(input, PROMPTS.default, session.model);
  const safe = esc(response.substring(0, 4000));
  await ctx.replyWithHTML(`<b>🧠 AI:</b>\n\n${safe}`, Markup.inlineKeyboard([
    [Markup.button.callback('🤖 Сменить модель', 'model_menu')],
    [Markup.button.callback('⬅️ Меню', 'back_start')]
  ]));
});

// ─── /model ───
bot.command('model', async (ctx) => {
  const session = getSession(ctx.from!.id);
  const curr = MODELS.find(m => m.id === session.model);

  let text = `<b>🤖 Выбор AI модели</b>\n\n${div}\n\n`;
  text += `<b>Текущая:</b> ${curr?.emoji || '🟢'} ${curr?.name || 'GPT-4o'}\n\n${tdiv}\n\n`;

  const cats: Record<string, Model[]> = {
    'OpenAI GPT': MODELS.filter(m => m.id.startsWith('openai/') && !m.id.includes('o') && !m.id.includes('gpt-5') && !m.isClaude),
    'GPT-5': MODELS.filter(m => m.id.startsWith('openai/gpt-5')),
    'Reasoning (o-series)': MODELS.filter(m => m.id.startsWith('openai/o')),
    'DeepSeek': MODELS.filter(m => m.id.startsWith('deepseek/')),
    'Meta Llama': MODELS.filter(m => m.id.startsWith('meta/')),
    'Mistral': MODELS.filter(m => m.id.startsWith('mistral-ai/')),
    'Microsoft Phi': MODELS.filter(m => m.id.startsWith('microsoft/')),
    'Cohere': MODELS.filter(m => m.id.startsWith('cohere/')),
    'Claude (режим)': MODELS.filter(m => m.isClaude),
  };

  for (const [cat, models] of Object.entries(cats)) {
    if (models.length === 0) continue;
    text += `<b>${cat}:</b>\n`;
    for (const m of models) text += `${m.emoji} ${m.name}\n`;
    text += '\n';
  }
  text += `<i>Всего: ${MODELS.length} моделей • Выбери 👇</i>`;

  const rows: any[] = [];
  const btns = MODELS.map(m => Markup.button.callback(`${m.emoji} ${m.name}`, `model_${m.id}`));
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);

  await ctx.replyWithHTML(text, Markup.inlineKeyboard(rows));
});

// ─── /openclaw ───
bot.command('openclaw', async (ctx) => {
  const input = ctx.message.text.replace('/openclaw', '').trim();
  const session = getSession(ctx.from!.id);

  if (!input) {
    let text = `<b>${OPENCLAW_INFO.name}</b>\n\n${div}\n\n`;
    text += `<b>Описание:</b> ${OPENCLAW_INFO.desc}\n\n`;
    text += `<b>Возможности:</b>\n`;
    for (const c of OPENCLAW_INFO.capabilities) text += `${c}\n`;
    text += `\n${tdiv}\n\n<b>Использование:</b>\n<i>/openclaw спроектируй REST API для магазина</i>\n\n<i>Опиши задачу 🦅</i>`;

    await ctx.replyWithHTML(text, Markup.inlineKeyboard([
      [Markup.button.callback('🦅 Запустить OpenClaw', 'openclaw_start')],
      [Markup.button.callback('⬅️ Меню', 'back_start')]
    ]));
    return;
  }

  session.mode = 'openclaw';
  session.agent = 'openclaw';
  await ctx.replyWithHTML('🦅 <b>OpenClaw запущен!</b>\n\n<i>Анализирую задачу...</i>');

  // OpenClaw uses GPT-4o for best results (not the user's selected model)
  const response = await aiChat(
    `As an autonomous agent, plan and execute this task step by step:\n\n${input}\n\nProvide a detailed plan with code/analysis where needed.`,
    OPENCLAW_INFO.prompt,
    'openai/gpt-4o' // Always use GPT-4o for OpenClaw
  );

  await ctx.replyWithHTML(`<b>🦅 OpenClaw:</b>\n\n${esc(response.substring(0, 4000))}`, Markup.inlineKeyboard([
    [Markup.button.callback('🦅 Продолжить', 'openclaw_start')],
    [Markup.button.callback('⬅️ Меню', 'back_start')]
  ]));
});

// ─── /super ───
bot.command('super', async (ctx) => {
  let list = `<b>🚀 Супер-Агенты</b>\n\n${div}\n\n`;
  for (const a of SUPER_AGENTS) {
    list += `<b>${a.name}</b>\n${a.desc}\n<i>${'█'.repeat(Math.floor(a.power / 10))}${'░'.repeat(10 - Math.floor(a.power / 10))} ${a.power}%</i>\n${tdiv}\n`;
  }
  list += `\n<i>Выбери 👇</i>`;
  const btns = SUPER_AGENTS.map(a => Markup.button.callback(a.name.split(' ')[0] + ' ' + a.name.split(' ')[1], `super_${a.id}`));
  const rows: any[] = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.replyWithHTML(list, Markup.inlineKeyboard(rows));
});

// ─── /team ───
bot.command('team', async (ctx) => {
  let list = `<b>👥 Команда AI</b>\n\n${div}\n\n`;
  for (const a of AI_AGENTS) {
    list += `<b>${a.name}</b>\n${a.desc}\n${tdiv}\n`;
  }
  list += `\n<i>Выбери 👇</i>`;
  const btns = AI_AGENTS.map(a => Markup.button.callback(a.emoji + ' ' + a.name.split(' ')[1], `agent_${a.id}`));
  const rows: any[] = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.replyWithHTML(list, Markup.inlineKeyboard(rows));
});

// ─── /code ───
bot.command('code', async (ctx) => {
  const input = ctx.message.text.replace('/code', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) {
    await ctx.replyWithHTML(`<b>💻 Генератор кода</b>\n\n${div}\n\n<i>/code функция на Python</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
    return;
  }
  await ctx.replyWithHTML('💻 <i>Пишу код...</i>');
  const resp = await aiChat(`Write code for: ${input}. Only return the code with a brief explanation.`, PROMPTS.coder, session.model);
  await ctx.replyWithHTML(`<b>💻 Код:</b>\n\n${esc(resp.substring(0, 4000))}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /translate ───
bot.command('translate', async (ctx) => {
  const input = ctx.message.text.replace('/translate', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) {
    await ctx.replyWithHTML(`<b>🌐 Переводчик</b>\n\n<i>/translate Hello world</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
    return;
  }
  await ctx.replyWithHTML('🌐 <i>Перевожу...</i>');
  const resp = await aiChat(`Translate: "${input}". EN→RU, RU→EN. Only return translation.`, PROMPTS.translator, session.model);
  await ctx.replyWithHTML(`<b>🌐 Перевод:</b>\n\n${esc(resp.substring(0, 4000))}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /img ───
bot.command('img', async (ctx) => {
  const input = ctx.message.text.replace('/img', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) {
    await ctx.replyWithHTML(`<b>🎨 Генератор картинок</b>\n\n${div}\n\n<i>/img космический котёнок</i>\n\n<b>Модель:</b> ${session.imageModel}`, Markup.inlineKeyboard([
      [Markup.button.callback('🎨 Flux', 'imgmodel_flux'), Markup.button.callback('🖌️ Sana', 'imgmodel_sana'), Markup.button.callback('⚡ Turbo', 'imgmodel_turbo')],
      [Markup.button.callback('⬅️ Меню', 'back_start')]
    ]));
    return;
  }
  await ctx.replyWithHTML(`🎨 <i>Рисую через ${session.imageModel}...</i>`);
  const url = await aiImage(input, session.imageModel);
  await ctx.replyWithPhoto({ url }, {
    caption: `<b>🎨 ${esc(input)}</b>\n<i>Модель: ${session.imageModel}</i>`,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('🎨 Ещё', 'art_gen')], [Markup.button.callback('⬅️ Меню', 'back_start')]]),
  });
});

// ─── /idea ───
bot.command('idea', async (ctx) => {
  const topic = ctx.message.text.replace('/idea', '').trim();
  const session = getSession(ctx.from!.id);
  await ctx.replyWithHTML('💡 <i>Генерирую...</i>');
  const resp = await aiChat(topic ? `Generate a creative idea about: ${topic}` : 'Generate a random creative startup idea', PROMPTS.creative, session.model);
  await ctx.replyWithHTML(`<b>💡 Идея:</b>\n\n${esc(resp.substring(0, 4000))}`, Markup.inlineKeyboard([[Markup.button.callback('💡 Ещё', 'action_idea')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /chat ───
bot.command('chat', async (ctx) => {
  const input = ctx.message.text.replace('/chat', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) {
    await ctx.replyWithHTML(`<b>💬 Поговорим</b>\n\n<i>/chat Как дела?</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
    return;
  }
  await ctx.replyWithHTML('💬 <i>Думаю...</i>');
  const resp = await aiChat(input, PROMPTS.default, session.model);
  await ctx.replyWithHTML(`<b>💬 Aisunio:</b>\n\n${esc(resp.substring(0, 4000))}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /ask ───
bot.command('ask', async (ctx) => {
  const input = ctx.message.text.replace('/ask', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) {
    await ctx.replyWithHTML(`<b>❓ Спроси AI</b>\n\n<i>/ask Что такое AI?</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
    return;
  }
  await ctx.replyWithHTML('🧠 <i>Думаю...</i>');
  const resp = await aiChat(input, PROMPTS.mentor, session.model);
  await ctx.replyWithHTML(`<b>🧠 Ответ:</b>\n\n${esc(resp.substring(0, 4000))}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ═══════════════════════════════════════
// GITHUB SKILLS COMMANDS
// ═══════════════════════════════════════

// ─── /github — меню GitHub Skills ───
bot.command('github', async (ctx) => {
  let text = `<b>📦 GitHub Skills</b>\n\n${div}\n\n`;
  text += `<b>Токен:</b> ${GITHUB_TOKEN ? '✅ Подключён' : '❌ Нет'}\n\n${tdiv}\n\n`;
  for (const s of GITHUB_SKILLS) {
    text += `<b>${s.name}</b> — ${s.desc}\n<i>${s.cmd}</i>\n${tdiv}\n`;
  }
  text += `\n<i>Выбери навык 👇</i>`;
  const btns = GITHUB_SKILLS.map(s => Markup.button.callback(s.name.split(' ')[0] + ' ' + (s.name.split(' ')[1] || ''), `gh_${s.id}`));
  const rows: any[] = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.replyWithHTML(text, Markup.inlineKeyboard(rows));
});

// ─── /gh_repos ───
bot.command('gh_repos', async (ctx) => {
  if (!GITHUB_TOKEN) { await ctx.replyWithHTML('❌ GitHub токен не подключён'); return; }
  await ctx.replyWithHTML('📦 <i>Загружаю репозитории...</i>');
  const repos = await ghAPI('/user/repos?sort=updated&per_page=10');
  if (!repos || !Array.isArray(repos)) { await ctx.replyWithHTML('❌ Ошибка получения репозиториев'); return; }
  let text = `<b>📦 Твои репозитории</b>\n\n${div}\n\n`;
  for (const r of repos) {
    text += `<b>${esc(r.full_name)}</b>\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count} | 📝 ${r.language || '?'}\n${esc(r.description || 'Нет описания')}\n${tdiv}\n`;
  }
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /gh_profile ───
bot.command('gh_profile', async (ctx) => {
  if (!GITHUB_TOKEN) { await ctx.replyWithHTML('❌ GitHub токен не подключён'); return; }
  await ctx.replyWithHTML('👤 <i>Загружаю профиль...</i>');
  const user = await ghAPI('/user');
  if (!user) { await ctx.replyWithHTML('❌ Ошибка'); return; }
  const text = `<b>👤 GitHub профиль</b>\n\n${div}\n\n<b>Имя:</b> ${esc(user.login)}\n<b>Имя:</b> ${esc(user.name || 'N/A')}\n<b>ID:</b> <code>${user.id}</code>\n<b>Репо:</b> ${user.public_repos}\n<b>Подписчики:</b> ${user.followers}\n<b>Подписки:</b> ${user.following}\n<b>Создан:</b> ${user.created_at?.substring(0, 10)}\n<b>Био:</b> ${esc(user.bio || 'N/A')}\n\n🔗 <a href="${user.html_url}">Открыть на GitHub</a>`;
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /gh_commits ───
bot.command('gh_commits', async (ctx) => {
  if (!GITHUB_TOKEN) { await ctx.replyWithHTML('❌ GitHub токен не подключён'); return; }
  const input = ctx.message.text.replace('/gh_commits', '').trim() || 'muromec061-cyber/virtnum';
  await ctx.replyWithHTML('📝 <i>Загружаю коммиты...</i>');
  const commits = await ghAPI(`/repos/${input}/commits?per_page=10`);
  if (!commits || !Array.isArray(commits)) { await ctx.replyWithHTML('❌ Ошибка. Формат: /gh_commits owner/repo'); return; }
  let text = `<b>📝 Коммиты: ${esc(input)}</b>\n\n${div}\n\n`;
  for (const c of commits) {
    const msg = c.commit?.message?.split('\n')[0]?.substring(0, 60) || '?';
    const sha = c.sha?.substring(0, 7) || '?';
    const date = c.commit?.author?.date?.substring(0, 10) || '?';
    text += `<b>${date}</b> <code>${sha}</code>\n${esc(msg)}\n${tdiv}\n`;
  }
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /gh_issues ───
bot.command('gh_issues', async (ctx) => {
  if (!GITHUB_TOKEN) { await ctx.replyWithHTML('❌ GitHub токен не подключён'); return; }
  const input = ctx.message.text.replace('/gh_issues', '').trim() || 'muromec061-cyber/virtnum';
  await ctx.replyWithHTML('🐛 <i>Загружаю issues...</i>');
  const issues = await ghAPI(`/repos/${input}/issues?state=open&per_page=10`);
  if (!issues || !Array.isArray(issues)) { await ctx.replyWithHTML('❌ Ошибка. Формат: /gh_issues owner/repo'); return; }
  let text = `<b>🐛 Issues: ${esc(input)}</b>\n\n${div}\n\n`;
  if (issues.length === 0) text += '✅ Нет открытых issues!\n';
  for (const i of issues) {
    text += `#${i.number} <b>${esc(i.title?.substring(0, 50) || '?')}</b>\n${esc(i.body?.substring(0, 100) || 'Нет описания')}\n${tdiv}\n`;
  }
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /gh_search ───
bot.command('gh_search', async (ctx) => {
  if (!GITHUB_TOKEN) { await ctx.replyWithHTML('❌ GitHub токен не подключён'); return; }
  const input = ctx.message.text.replace('/gh_search', '').trim();
  if (!input) { await ctx.replyWithHTML(`<b>🔍 Поиск кода</b>\n\n<i>/gh_search telegraf bot start</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])); return; }
  await ctx.replyWithHTML('🔍 <i>Ищу...</i>');
  const results = await ghAPI(`/search/code?q=${encodeURIComponent(input)}&per_page=5`);
  if (!results || !results.items) { await ctx.replyWithHTML('❌ Ничего не найдено'); return; }
  let text = `<b>🔍 Результаты: ${esc(input)}</b>\n\n${div}\n\n`;
  for (const item of results.items.slice(0, 5)) {
    text += `<b>${esc(item.repository?.full_name || '?')}</b>\n📄 ${esc(item.name || '?')}\n🔗 <a href="${item.html_url}">Открыть</a>\n${tdiv}\n`;
  }
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /skill_create ───
bot.command('skill_create', async (ctx) => {
  const input = ctx.message.text.replace('/skill_create', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) {
    await ctx.replyWithHTML(
      `<b>🛠️ Skill Create</b>\n\n${div}\n\nСоздать новый файл в репозитории через AI.\n\n<i>/skill_create создай README.md с описанием бота</i>\n\nAI напишет содержимое и создаст файл в GitHub.`,
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])
    );
    return;
  }
  await ctx.replyWithHTML('🛠️ <i>AI создаёт файл...</i>');
  const aiResp = await aiChat(`Generate the content for this file: ${input}. Only return the file content, no explanations.`, PROMPTS.coder, session.model);
  
  // Determine file path from input
  const fileName = input.split(' ').find((w: string) => w.includes('.')) || 'new_file.md';
  const repo = 'muromec061-cyber/virtnum';
  
  // Get current file SHA if exists
  const existing = await ghAPI(`/repos/${repo}/contents/${fileName}`);
  const sha = existing?.sha;
  
  // Create/update file
  const content = Buffer.from(aiResp).toString('base64');
  const result = await ghAPI(`/repos/${repo}/contents/${fileName}`, 'PUT', {
    message: `🤖 Skill Create: ${fileName}`,
    content: content,
    sha: sha,
  });
  
  if (result && result.content) {
    await ctx.replyWithHTML(`✅ <b>Файл создан!</b>\n\n📄 ${esc(fileName)}\n🔗 <a href="${result.content.html_url}">Открыть</a>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  } else {
    await ctx.replyWithHTML(`⚠️ Не удалось создать файл. AI содержимое:\n\n<pre>${esc(aiResp.substring(0, 2000))}</pre>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  }
});

// ─── /gh_status ───
bot.command('gh_status', async (ctx) => {
  const status = await ghAPI('/rate_limit');
  if (!status) { await ctx.replyWithHTML('❌ Ошибка получения статуса'); return; }
  const core = status.resources?.core || {};
  const text = `<b>📊 GitHub API Status</b>\n\n${div}\n\n<b>Лимит:</b> ${core.limit || '?'}\n<b>Использовано:</b> ${core.used || '?'}\n<b>Осталось:</b> ${core.remaining || '?'}\n<b>Сброс:</b> ${new Date((core.reset || 0) * 1000).toLocaleTimeString('ru-RU')}\n\n${tdiv}\n<b>GitHub Models API:</b> ✅\n<b>Токен:</b> ${GITHUB_TOKEN ? '✅' : '❌'}`;
  await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /help ───
bot.command('help', async (ctx) => {
  const t = `<b>📋 Все команды v5.1</b>\n\n${div}\n\n<b>🧠 AI (${MODELS.length} моделей):</b>\n/ai — AI режим\n/model — выбор модели\n/ask &lt;вопрос&gt; — спросить\n/chat &lt;текст&gt; — поговорить\n/code &lt;задача&gt; — код\n/translate &lt;текст&gt; — перевод\n/img &lt;описание&gt; — картинки\n/idea &lt;тема&gt; — идеи\n\n<b>🦅 OpenClaw:</b>\n/openclaw &lt;задача&gt; — автономный агент\n\n<b>🎭 Claude:</b>\n/model → Claude Sonnet/Opus/Haiku\n\n<b>📦 GitHub Skills:</b>\n/github — меню skills\n/gh_repos — репозитории\n/gh_profile — профиль\n/gh_commits &lt;repo&gt; — коммиты\n/gh_issues &lt;repo&gt; — issues\n/gh_search &lt;текст&gt; — поиск кода\n/skill_create &lt;файл&gt; — создать файл\n/gh_status — лимиты API\n\n<b>🚀 Агенты:</b>\n/super — 6 супер-агентов\n/team — 8 агентов команды\n\n<b>🛠️ Инструменты:</b>\n/calc /pass /uuid /hash /qr /shorten\n\n<b>🎲 Разное:</b>\n/random /quote /joke /8ball /coin /dice /emoji /art /mood\n\n<b>📊 Инфо:</b>\n/about /settings /status /weather /time\n\n${div}\n<i>35+ команд • ${MODELS.length} моделей • OpenClaw ✅ • GitHub ✅</i>`;
  await ctx.replyWithHTML(t, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /about ───
bot.command('about', async (ctx) => {
  await ctx.replyWithHTML(
    `<b>ℹ️ Aisunio v5.1</b>\n\n${div}\n\n<b>🤖 Имя:</b> Aisunio\n<b>⚡ Версия:</b> 5.1.0\n<b>🧠 AI:</b> ${MODELS.length} моделей (GitHub Models)\n<b>🎭 Claude:</b> 3 режима (Sonnet/Opus/Haiku)\n<b>🎨 Images:</b> Flux + Sana (Pollinations)\n<b>🦅 OpenClaw:</b> ✅ Автономный агент\n<b>📦 GitHub:</b> ✅ Skills + API\n<b>🔧 Движок:</b> Telegraf + Node.js\n<b>📝 Команд:</b> 35+\n\n${tdiv}\n<b>Модели:</b>\n${MODELS.map(m => `${m.emoji} ${m.name}`).join(', ')}\n\n<i>Сделано с ❤️</i>`,
    Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])
  );
});

// ─── /status ───
bot.command('status', async (ctx) => {
  const up = process.uptime();
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
  const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const session = getSession(ctx.from!.id);
  const model = MODELS.find(mo => mo.id === session.model) || MODELS[0];
  await ctx.replyWithHTML(
    `<b>📊 Статус</b>\n\n${div}\n\n<b>🟢 Бот:</b> Онлайн\n<b>⏱️ Uptime:</b> ${h}ч ${m}м ${s}с\n<b>💾 Память:</b> ${mem} MB\n<b>📦 Node:</b> ${process.version}\n<b>🧠 AI:</b> ✅ ${MODELS.length} моделей\n<b>🎭 Claude:</b> ✅ 3 режима\n<b>🎨 Images:</b> ✅ Flux + Sana\n<b>🦅 OpenClaw:</b> ✅ Активен\n<b>📦 GitHub:</b> ✅ Skills активны\n<b>🤖 Агентов:</b> ${AI_AGENTS.length + SUPER_AGENTS.length + 1}\n<b>📡 Модель:</b> ${model.emoji} ${model.name}\n\n<i>Все системы ✅</i>`,
    Markup.inlineKeyboard([[Markup.button.callback('🔄 Обновить', 'status_cmd')], [Markup.button.callback('⬅️ Меню', 'back_start')]])
  );
});

// ─── /settings ───
bot.command('settings', async (ctx) => {
  const session = getSession(ctx.from!.id);
  const model = MODELS.find(m => m.id === session.model) || MODELS[0];
  await ctx.replyWithHTML(
    `<b>⚙️ Настройки</b>\n\n${div}\n\n<b>👤 Имя:</b> ${esc(ctx.from?.first_name || '?')}\n<b>🆔 ID:</b> <code>${ctx.from?.id}</code>\n<b>🌐 Язык:</b> ${ctx.from?.language_code || 'ru'}\n<b>📱 Username:</b> ${ctx.from?.username ? '@' + ctx.from?.username : 'N/A'}\n\n${tdiv}\n<b>AI модель:</b> ${model.emoji} ${model.name}\n<b>Image модель:</b> ${session.imageModel}\n<b>Режим:</b> ${session.mode}\n<b>GitHub Models:</b> ${GITHUB_TOKEN ? '✅' : '❌'}\n<b>GitHub API:</b> ${GITHUB_TOKEN ? '✅' : '❌'}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🤖 Сменить модель', 'model_menu')],
      [Markup.button.callback('⬅️ Меню', 'back_start')]
    ])
  );
});

// ─── /weather ───
bot.command('weather', async (ctx) => {
  const input = ctx.message.text.replace('/weather', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) { await ctx.replyWithHTML(`<b>☀️ Погода</b>\n\n<i>/weather Москва</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])); return; }
  await ctx.replyWithHTML('☀️ <i>Узнаю...</i>');
  const resp = await aiChat(`What is the weather in ${input}? Give a brief report in Russian.`, PROMPTS.default, session.model);
  await ctx.replyWithHTML(`<b>☀️ ${esc(input)}</b>\n\n${esc(resp.substring(0, 2000))}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /time ───
bot.command('time', async (ctx) => {
  const now = new Date();
  const time = now.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' });
  const date = now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Moscow' });
  await ctx.replyWithHTML(`<b>🕐 Время</b>\n\n${div}\n\n<b>📅 ${esc(date)}</b>\n<b>⏰ <code>${time}</code></b>\n<b>🌍 Москва UTC+3</b>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /calc ───
bot.command('calc', async (ctx) => {
  const input = ctx.message.text.replace('/calc', '').trim();
  if (!input) { await ctx.replyWithHTML(`<b>🧮 Калькулятор</b>\n\n<i>/calc 2+2*10</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])); return; }
  try {
    const clean = input.replace(/[^0-9+\-*/().\s]/g, '');
    const r = Function(`"use strict";return(${clean})`)();
    await ctx.replyWithHTML(`<b>🧮 ${esc(clean)} = <code>${r}</code></b>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  } catch { await ctx.replyWithHTML('❌ Ошибка в выражении'); }
});

// ─── /pass ───
bot.command('pass', async (ctx) => {
  const input = ctx.message.text.replace('/pass', '').trim();
  const len = Math.min(Math.max(parseInt(input) || 16, 8), 64);
  const ch = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let pw = ''; for (let i = 0; i < len; i++) pw += ch[Math.floor(Math.random() * ch.length)];
  await ctx.replyWithHTML(`<b>🔐 Пароль (${len})</b>\n\n<code>${esc(pw)}</code>`, Markup.inlineKeyboard([[Markup.button.callback('🔐 Новый', 'action_pass')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /uuid ───
bot.command('uuid', async (ctx) => {
  await ctx.replyWithHTML(`<b>🆔 UUID</b>\n\n<code>${crypto.randomUUID()}</code>`, Markup.inlineKeyboard([[Markup.button.callback('🆔 Ещё', 'action_uuid')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /hash ───
bot.command('hash', async (ctx) => {
  const input = ctx.message.text.replace('/hash', '').trim();
  if (!input) { await ctx.replyWithHTML(`<b>#️⃣ Хеш</b>\n\n<i>/hash hello</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])); return; }
  const c = require('crypto');
  const md5 = c.createHash('md5').update(input).digest('hex');
  const sha = c.createHash('sha256').update(input).digest('hex');
  await ctx.replyWithHTML(`<b>#️⃣ ${esc(input)}</b>\n\n<b>MD5:</b> <code>${md5}</code>\n<b>SHA256:</b> <code>${sha}</code>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ─── /qr ───
bot.command('qr', async (ctx) => {
  const input = ctx.message.text.replace('/qr', '').trim();
  if (!input) { await ctx.replyWithHTML(`<b>📱 QR-код</b>\n\n<i>/qr https://t.me/Base447bot</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])); return; }
  await ctx.replyWithPhoto({ url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(input)}` }, { caption: `📱 ${esc(input)}`, parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});

// ─── /shorten ───
bot.command('shorten', async (ctx) => {
  const input = ctx.message.text.replace('/shorten', '').trim();
  if (!input?.startsWith('http')) { await ctx.replyWithHTML(`<b>🔗 Короткая ссылка</b>\n\n<i>/shorten https://example.com</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])); return; }
  https.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(input)}`, (res: any) => { let d = ''; res.on('data', (c: any) => d += c); res.on('end', () => ctx.replyWithHTML(`<b>🔗</b>\n→ <code>${esc(d)}</code>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]))); }).on('error', () => ctx.replyWithHTML('❌ Ошибка'));
});

// ─── /random /quote /joke /8ball /coin /dice /emoji /art /mood ───
bot.command('random', async (ctx) => await ctx.replyWithHTML(`🎲 <b>Случайное:</b> <code>${Math.floor(Math.random() * 100) + 1}</code>`, Markup.inlineKeyboard([[Markup.button.callback('🎲 Ещё', 'action_random')], [Markup.button.callback('⬅️ Меню', 'back_start')]])));

bot.command('quote', async (ctx) => {
  const qs = [{ t: 'Лучший способ предсказать будущее — создать его.', a: 'Друкер' }, { t: 'Инновация отличает лидера от догоняющего.', a: 'Джобс' }, { t: 'AI не заменит людей. Люди с AI заменят людей без AI.', a: '—' }, { t: 'Простота — это sophistication.', a: 'Винчи' }, { t: 'Код — это поэзия.', a: '—' }];
  const q = qs[Math.floor(Math.random() * qs.length)];
  await ctx.replyWithHTML(`📖 <i>"${esc(q.t)}"</i>\n— <b>${esc(q.a)}</b>`, Markup.inlineKeyboard([[Markup.button.callback('📖 Ещё', 'action_quote')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('joke', async (ctx) => {
  const session = getSession(ctx.from!.id);
  await ctx.replyWithHTML('😂 <i>Шучу...</i>');
  const resp = await aiChat('Tell a short funny programming joke in Russian.', PROMPTS.creative, session.model);
  await ctx.replyWithHTML(`😂 ${esc(resp.substring(0, 2000))}`, Markup.inlineKeyboard([[Markup.button.callback('😂 Ещё', 'action_joke')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('8ball', async (ctx) => {
  const input = ctx.message.text.replace('/8ball', '').trim();
  const session = getSession(ctx.from!.id);
  if (!input) { await ctx.replyWithHTML(`<b>🔮 Магический шар</b>\n\n<i>/8ball Стоит учить Rust?</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]])); return; }
  await ctx.replyWithHTML('🔮 <i>Шар думает...</i>');
  const resp = await aiChat(`Answer this yes/no question briefly in Russian: "${input}"`, 'You are a magic 8-ball. Short mysterious answer in Russian.', session.model);
  await ctx.replyWithHTML(`🔮 <i>${esc(input)}</i>\n\n<b>${esc(resp.substring(0, 500))}</b>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('coin', async (ctx) => await ctx.replyWithHTML(`🪙 ${Math.random() < 0.5 ? 'Орёл!' : 'Решка!'}`, Markup.inlineKeyboard([[Markup.button.callback('🪙 Ещё', 'action_coin')], [Markup.button.callback('⬅️ Меню', 'back_start')]])));

bot.command('dice', async (ctx) => { await ctx.replyWithHTML(`🎲 ${Math.floor(Math.random() * 6) + 1}`); await ctx.replyWithDice(); });

bot.command('emoji', async (ctx) => {
  const es = ['😎', '🤖', '🚀', '🎉', '💎', '🔥', '⚡', '🌟', '🎨', '🎮', '🎸', '🌈', '🧠', '💜', '🏆', '🦄', '🐉', '✨', '🥳'];
  await ctx.replyWithHTML(`${es[Math.floor(Math.random() * es.length)]}`, Markup.inlineKeyboard([[Markup.button.callback('😎 Ещё', 'action_emoji')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('art', async (ctx) => {
  const arts = [`╔══════════════════════════╗\n║  🤖  A I S U N I O  🤖    ║\n║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%  ║\n║  STATUS: ONLINE          ║\n║  AI: GPT-5 + Claude      ║\n╚══════════════════════════╝`, `  ╔══════════════════════════════╗\n  ║  🚀 S U P E R  A G E N T 🚀  ║\n  ║  [████████████] 100%        ║\n  ║  AI: ✅  IMG: ✅  CLAW: ✅   ║\n  ╚══════════════════════════════╝`];
  await ctx.replyWithHTML(`<b>🎨 ASCII</b>\n\n<pre>${esc(arts[Math.floor(Math.random() * arts.length)])}</pre>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.command('mood', async (ctx) => {
  const ms = [{ e: '😄', m: 'Отличное!', a: 'Время творить!' }, { e: '😎', m: 'Уверенное', a: 'Ты можешь всё!' }, { e: '🔥', m: 'Заряженное!', a: 'Вперёд!' }, { e: '🙂', m: 'Хорошее', a: 'Продуктивный день!' }, { e: '🤩', m: 'Восторг!', a: 'Лови вдохновение!' }];
  const m = ms[Math.floor(Math.random() * ms.length)];
  await ctx.replyWithHTML(`<b>${m.e} ${m.m}</b>\n\n<i>${m.a}</i>`, Markup.inlineKeyboard([[Markup.button.callback('🎭 Ещё', 'action_mood')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

// ═══════════════════════════════════════
// CALLBACKS
// ═══════════════════════════════════════

bot.action('back_start', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(`<b>👋 ${esc(ctx.from?.first_name || 'друг')}, ты в меню!</b>\n\n${div}\n\n<b>🤖 Aisunio v5.1</b> — AI Super Agent\n\n<i>Выбери 👇</i>`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('🧠 Спросить AI', 'ai_chat'), Markup.button.callback('🤖 Выбор модели', 'model_menu')],
      [Markup.button.callback('👥 Команда', 'team_menu'), Markup.button.callback('🚀 Супер-агенты', 'super_menu')],
      [Markup.button.callback('🦅 OpenClaw', 'openclaw_menu'), Markup.button.callback('📦 GitHub Skills', 'github_menu')],
      [Markup.button.callback('🎨 Арты', 'art_gen'), Markup.button.callback('🎭 Claude', 'claude_menu')],
      [Markup.button.callback('📋 Команды', 'help_cmd'), Markup.button.callback('📊 Статус', 'status_cmd')],
    ]) }
  );
});

bot.action('ai_chat', async (ctx) => {
  await ctx.answerCbQuery('🧠 AI!');
  const session = getSession(ctx.from!.id);
  session.mode = 'ai';
  const model = MODELS.find(m => m.id === session.model) || MODELS[0];
  await ctx.editMessageText(`<b>🧠 AI режим!</b>\n\n${div}\n\n<b>Модель:</b> ${model.emoji} ${model.name}\n\nПиши вопросы — отвечу через AI.\n\n<i>Пиши 👇</i>`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🤖 Сменить модель', 'model_menu')], [Markup.button.callback('⬅️ Меню', 'back_start')]]) }
  );
});

// ─── Claude menu ───
bot.action('claude_menu', async (ctx) => {
  await ctx.answerCbQuery('🎭 Claude!');
  const claudeModels = MODELS.filter(m => m.isClaude);
  let text = `<b>🎭 Claude (режим)</b>\n\n${div}\n\n`;
  text += `Claude недоступен бесплатно через API, но я создал <b>Claude-режим</b> — GPT-4o работает с личностью Claude.\n\n${tdiv}\n\n`;
  for (const m of claudeModels) {
    text += `${m.emoji} <b>${m.name}</b> — ${m.desc}\n`;
  }
  text += `\n<i>Выбери 👇</i>`;
  const btns = claudeModels.map(m => Markup.button.callback(`${m.emoji} ${m.name}`, `model_${m.id}`));
  const rows: any[] = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

// ─── GitHub menu ───
bot.action('github_menu', async (ctx) => {
  await ctx.answerCbQuery();
  let text = `<b>📦 GitHub Skills</b>\n\n${div}\n\n`;
  text += `<b>Токен:</b> ${GITHUB_TOKEN ? '✅ Подключён' : '❌ Нет'}\n\n${tdiv}\n\n`;
  for (const s of GITHUB_SKILLS) {
    text += `<b>${s.name}</b> — ${s.desc}\n<i>${s.cmd}</i>\n${tdiv}\n`;
  }
  text += `\n<i>Выбери 👇</i>`;
  const btns = GITHUB_SKILLS.map(s => Markup.button.callback(s.name.split(' ')[0] + ' ' + (s.name.split(' ')[1] || ''), `gh_${s.id}`));
  const rows: any[] = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

// GitHub skill callbacks
const ghHandlers: Record<string, (ctx: any) => Promise<void>> = {
  repo: async (ctx) => {
    await ctx.answerCbQuery('📦 Загружаю...');
    const repos = await ghAPI('/user/repos?sort=updated&per_page=10');
    if (!repos || !Array.isArray(repos)) { await ctx.replyWithHTML('❌ Ошибка'); return; }
    let text = `<b>📦 Репозитории</b>\n\n${div}\n\n`;
    for (const r of repos) { text += `<b>${esc(r.full_name)}</b>\n⭐${r.stargazers_count} 🍴${r.forks_count} 📝${r.language || '?'}\n${esc(r.description || '—')}\n${tdiv}\n`; }
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  issues: async (ctx) => {
    await ctx.answerCbQuery('🐛 Загружаю...');
    const issues = await ghAPI('/repos/muromec061-cyber/virtnum/issues?state=open&per_page=10');
    if (!issues || !Array.isArray(issues)) { await ctx.replyWithHTML('❌ Ошибка'); return; }
    let text = `<b>🐛 Issues: virtnum</b>\n\n${div}\n\n`;
    if (issues.length === 0) text += '✅ Нет открытых issues!\n';
    for (const i of issues) { text += `#${i.number} <b>${esc(i.title?.substring(0, 50) || '?')}</b>\n${tdiv}\n`; }
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  commits: async (ctx) => {
    await ctx.answerCbQuery('📝 Загружаю...');
    const commits = await ghAPI('/repos/muromec061-cyber/virtnum/commits?per_page=10');
    if (!commits || !Array.isArray(commits)) { await ctx.replyWithHTML('❌ Ошибка'); return; }
    let text = `<b>📝 Коммиты: virtnum</b>\n\n${div}\n\n`;
    for (const c of commits) { text += `<code>${c.sha?.substring(0, 7)}</code> ${esc(c.commit?.message?.split('\n')[0]?.substring(0, 50) || '?')}\n`; }
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  search: async (ctx) => {
    await ctx.answerCbQuery('🔍 Поиск');
    await ctx.replyWithHTML(`<b>🔍 Поиск кода</b>\n\n<i>/gh_search telegraf bot</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  skill_create: async (ctx) => {
    await ctx.answerCbQuery('🛠️ Skill Create');
    await ctx.replyWithHTML(`<b>🛠️ Skill Create</b>\n\n${div}\n\nСоздать файл через AI:\n\n<i>/skill_create создай utils.ts с хелпер функциями</i>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  gh_status: async (ctx) => {
    await ctx.answerCbQuery('📊');
    const status = await ghAPI('/rate_limit');
    if (!status) { await ctx.replyWithHTML('❌ Ошибка'); return; }
    const core = status.resources?.core || {};
    await ctx.replyWithHTML(`<b>📊 GitHub API</b>\n\n${div}\n\n<b>Лимит:</b> ${core.limit || '?'}\n<b>Осталось:</b> ${core.remaining || '?'}\n<b>Сброс:</b> ${new Date((core.reset || 0) * 1000).toLocaleTimeString('ru-RU')}\n\n<b>GitHub Models:</b> ✅\n<b>Токен:</b> ${GITHUB_TOKEN ? '✅' : '❌'}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  user_info: async (ctx) => {
    await ctx.answerCbQuery('👤');
    const user = await ghAPI('/user');
    if (!user) { await ctx.replyWithHTML('❌ Ошибка'); return; }
    await ctx.replyWithHTML(`<b>👤 GitHub</b>\n\n${div}\n\n<b>${esc(user.login)}</b>\n📊 Репо: ${user.public_repos}\n👥 Подписчики: ${user.followers}\n\n🔗 <a href="${user.html_url}">Профиль</a>`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  pulls: async (ctx) => {
    await ctx.answerCbQuery('🔀 PRs');
    const prs = await ghAPI('/repos/muromec061-cyber/virtnum/pulls?state=open&per_page=10');
    if (!prs || !Array.isArray(prs)) { await ctx.replyWithHTML('❌ Ошибка'); return; }
    let text = `<b>🔀 Pull Requests: virtnum</b>\n\n${div}\n\n`;
    if (prs.length === 0) text += '✅ Нет открытых PR!\n';
    for (const p of prs) { text += `#${p.number} <b>${esc(p.title?.substring(0, 50) || '?')}</b>\n${tdiv}\n`; }
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  branches: async (ctx) => {
    await ctx.answerCbQuery('🌿');
    const branches = await ghAPI('/repos/muromec061-cyber/virtnum/branches?per_page=10');
    if (!branches || !Array.isArray(branches)) { await ctx.replyWithHTML('❌ Ошибка'); return; }
    let text = `<b>🌿 Ветки: virtnum</b>\n\n${div}\n\n`;
    for (const b of branches) { text += `📦 <b>${esc(b.name)}</b>\n`; }
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
  releases: async (ctx) => {
    await ctx.answerCbQuery('🏷️');
    const releases = await ghAPI('/repos/muromec061-cyber/virtnum/releases?per_page=5');
    if (!releases || !Array.isArray(releases)) { await ctx.replyWithHTML('❌ Ошибка или нет релизов'); return; }
    let text = `<b>🏷️ Релизы: virtnum</b>\n\n${div}\n\n`;
    if (releases.length === 0) text += '📦 Нет релизов\n';
    for (const r of releases) { text += `🏷️ <b>${esc(r.tag_name || '?')}</b>\n${esc(r.name || '')}\n${tdiv}\n`; }
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  },
};

for (const [id, handler] of Object.entries(ghHandlers)) {
  bot.action(`gh_${id}`, handler);
}

// ─── Model selection menu ───
bot.action('model_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const session = getSession(ctx.from!.id);
  const curr = MODELS.find(m => m.id === session.model);
  let text = `<b>🤖 Выбор модели</b>\n\n${div}\n\n<b>Текущая:</b> ${curr?.emoji || '🟢'} ${curr?.name || 'GPT-4o'}\n\n${tdiv}\n\n`;
  const cats: Record<string, Model[]> = {
    'OpenAI': MODELS.filter(m => m.id.startsWith('openai/') && !m.id.includes('o') && !m.id.includes('gpt-5') && !m.isClaude),
    'GPT-5': MODELS.filter(m => m.id.startsWith('openai/gpt-5')),
    'Reasoning': MODELS.filter(m => m.id.startsWith('openai/o')),
    'DeepSeek': MODELS.filter(m => m.id.startsWith('deepseek/')),
    'Meta': MODELS.filter(m => m.id.startsWith('meta/')),
    'Mistral': MODELS.filter(m => m.id.startsWith('mistral-ai/')),
    'Phi': MODELS.filter(m => m.id.startsWith('microsoft/')),
    'Cohere': MODELS.filter(m => m.id.startsWith('cohere/')),
    'Claude': MODELS.filter(m => m.isClaude),
  };
  for (const [cat, models] of Object.entries(cats)) {
    if (models.length === 0) continue;
    text += `<b>${cat}:</b>\n`;
    for (const m of models) text += `${m.emoji} ${m.name}\n`;
    text += '\n';
  }
  text += `<i>Всего: ${MODELS.length} • Выбери 👇</i>`;
  const rows: any[] = [];
  const btns = MODELS.map(m => Markup.button.callback(`${m.emoji} ${m.name}`, `model_${m.id}`));
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

// Model selection callbacks
MODELS.forEach(m => {
  bot.action(`model_${m.id}`, async (ctx) => {
    await ctx.answerCbQuery(`${m.emoji} ${m.name}!`);
    const session = getSession(ctx.from!.id);
    session.model = m.id;
    const extra = m.isClaude ? '\n\n<i>🎭 Claude-режим: GPT-4o работает с личностью Claude</i>' : '';
    await ctx.editMessageText(`<b>${m.emoji} ${m.name}</b>\n\n${div}\n\n${m.desc}\n\n<b>Статус:</b> ✅ Активна${extra}\n\n<i>Пиши вопросы!</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🤖 Другая', 'model_menu')], [Markup.button.callback('⬅️ Меню', 'back_start')]]) }
    );
  });
});

// ─── OpenClaw menu ───
bot.action('openclaw_menu', async (ctx) => {
  await ctx.answerCbQuery('🦅 OpenClaw!');
  let text = `<b>${OPENCLAW_INFO.name}</b>\n\n${div}\n\n<b>Описание:</b> ${OPENCLAW_INFO.desc}\n\n<b>Возможности:</b>\n`;
  for (const c of OPENCLAW_INFO.capabilities) text += `${c}\n`;
  text += `\n${tdiv}\n\n<i>/openclaw спроектируй REST API</i>\n\nИли нажми 👇`;
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🦅 Запустить', 'openclaw_start')], [Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});

bot.action('openclaw_start', async (ctx) => {
  await ctx.answerCbQuery('🦅 Запущен!');
  const session = getSession(ctx.from!.id);
  session.mode = 'openclaw';
  session.agent = 'openclaw';
  await ctx.editMessageText(`<b>🦅 OpenClaw активирован!</b>\n\n${div}\n\n${OPENCLAW_INFO.desc}\n\n${tdiv}\n\n<i>Опиши задачу:\n/openclaw создай план стартапа</i>`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]) }
  );
});

// ─── Art generator ───
bot.action('art_gen', async (ctx) => {
  await ctx.answerCbQuery('🎨');
  const session = getSession(ctx.from!.id);
  await ctx.editMessageText(`<b>🎨 Генератор артов</b>\n\n${div}\n\n<b>Модель:</b> ${session.imageModel}\n\n<i>/img космический котёнок</i>\n\nИли выбери:`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([
      [Markup.button.callback('🐱 Кот', 'gen_cat'), Markup.button.callback('🤖 Робот', 'gen_robot')],
      [Markup.button.callback('🌊 Закат', 'gen_sunset'), Markup.button.callback('🏔️ Горы', 'gen_mountains')],
      [Markup.button.callback('🎨 Flux', 'imgmodel_flux'), Markup.button.callback('🖌️ Sana', 'imgmodel_sana')],
      [Markup.button.callback('⬅️ Меню', 'back_start')],
    ]) }
  );
});

IMAGE_MODELS.forEach(im => {
  bot.action(`imgmodel_${im.id}`, async (ctx) => {
    await ctx.answerCbQuery(`${im.emoji} ${im.name}!`);
    const session = getSession(ctx.from!.id);
    session.imageModel = im.id;
    await ctx.replyWithHTML(`<b>${im.emoji} ${im.name}</b> — выбрана!`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]));
  });
});

const imgPrompts: Record<string, string> = {
  gen_cat: 'a cute cat astronaut in space, stars, nebula, digital art',
  gen_robot: 'a futuristic cute robot, glowing blue eyes, digital art',
  gen_sunset: 'beautiful sunset over ocean, palm trees, digital painting',
  gen_mountains: 'majestic snow mountains at dawn, golden light, digital art',
};
for (const [key, prompt] of Object.entries(imgPrompts)) {
  bot.action(key, async (ctx) => {
    await ctx.answerCbQuery('🎨 Рисую...');
    const session = getSession(ctx.from!.id);
    await ctx.replyWithHTML(`🎨 <i>Рисую через ${session.imageModel}...</i>`);
    const url = await aiImage(prompt, session.imageModel);
    await ctx.replyWithPhoto({ url }, { caption: '🎨 <i>AI Art</i>', parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🎨 Ещё', 'art_gen')], [Markup.button.callback('⬅️ Меню', 'back_start')]]) });
  });
}

// ─── Team/Super menus ───
bot.action('team_menu', async (ctx) => {
  await ctx.answerCbQuery();
  let list = `<b>👥 Команда AI</b>\n\n${div}\n\n`;
  for (const a of AI_AGENTS) { list += `<b>${a.name}</b>\n${a.desc}\n${tdiv}\n`; }
  list += `\n<i>Выбери 👇</i>`;
  const btns = AI_AGENTS.map(a => Markup.button.callback(a.emoji + ' ' + a.name.split(' ')[1], `agent_${a.id}`));
  const rows: any[] = []; for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.editMessageText(list, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

bot.action('super_menu', async (ctx) => {
  await ctx.answerCbQuery();
  let list = `<b>🚀 Супер-Агенты</b>\n\n${div}\n\n`;
  for (const a of SUPER_AGENTS) { list += `<b>${a.name}</b>\n${a.desc}\n<i>${'█'.repeat(Math.floor(a.power / 10))}${'░'.repeat(10 - Math.floor(a.power / 10))} ${a.power}%</i>\n${tdiv}\n`; }
  list += `\n<i>Выбери 👇</i>`;
  const btns = SUPER_AGENTS.map(a => Markup.button.callback(a.name.split(' ')[0] + ' ' + a.name.split(' ')[1], `super_${a.id}`));
  const rows: any[] = []; for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([Markup.button.callback('⬅️ Меню', 'back_start')]);
  await ctx.editMessageText(list, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

// ─── Help/Status callbacks ───
bot.action('help_cmd', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(`<b>📋 Команды v5.1</b>\n\n${div}\n\n<b>🧠 AI (${MODELS.length}):</b>\n/ai /model /ask /chat /code /translate /img /idea\n\n<b>🦅 OpenClaw:</b>\n/openclaw &lt;задача&gt;\n\n<b>📦 GitHub:</b>\n/github /gh_repos /gh_profile\n/gh_commits /gh_issues /gh_search\n/skill_create /gh_status\n\n<b>🚀 Агенты:</b>\n/super /team\n\n<b>🛠️ Инструменты:</b>\n/calc /pass /uuid /hash /qr /shorten\n\n<b>🎲 Разное:</b>\n/random /quote /joke /8ball /coin /dice /emoji /art /mood\n\n<b>📊 Инфо:</b>\n/about /settings /status /weather /time`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});

bot.action('status_cmd', async (ctx) => {
  await ctx.answerCbQuery();
  const up = process.uptime();
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
  const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const session = getSession(ctx.from!.id);
  const model = MODELS.find(mo => mo.id === session.model) || MODELS[0];
  await ctx.editMessageText(`<b>📊 Статус</b>\n\n${div}\n\n🟢 <b>Онлайн</b>\n⏱️ <b>${h}ч ${m}м ${s}с</b>\n💾 <b>${mem} MB</b>\n🧠 <b>AI: ✅ ${MODELS.length} моделей</b>\n🎭 <b>Claude: ✅ 3 режима</b>\n🦅 <b>OpenClaw: ✅</b>\n📦 <b>GitHub: ✅</b>\n🎨 <b>IMG: ✅ Flux+Sana</b>\n📡 <b>Модель: ${model.emoji} ${model.name}</b>\n\n<i>Всё ок ✅</i>`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Обновить', 'status_cmd')], [Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});

// ─── Agent selection ───
AI_AGENTS.forEach(a => {
  bot.action(`agent_${a.id}`, async (ctx) => {
    await ctx.answerCbQuery(`${a.name}!`);
    const session = getSession(ctx.from!.id);
    session.mode = 'agent';
    session.agent = a.id;
    await ctx.editMessageText(`<b>${a.name}</b>\n\n${div}\n\n${a.desc}\n\n✅ Активен\n\n<i>Опиши задачу!</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Команда', 'team_menu')], [Markup.button.callback('🏠 Меню', 'back_start')]]) }
    );
  });
});

SUPER_AGENTS.forEach(a => {
  bot.action(`super_${a.id}`, async (ctx) => {
    await ctx.answerCbQuery(`${a.name}!`);
    const session = getSession(ctx.from!.id);
    session.mode = 'super';
    session.agent = a.id;
    await ctx.editMessageText(`<b>${a.name}</b>\n\n${div}\n\n${a.desc}\n${'█'.repeat(Math.floor(a.power / 10))}${'░'.repeat(10 - Math.floor(a.power / 10))} ${a.power}%\n🚀 Запущен\n\n<i>Опиши задачу!</i>`,
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Супер', 'super_menu')], [Markup.button.callback('🏠 Меню', 'back_start')]]) }
    );
  });
});

// ─── Quick actions ───
bot.action('action_idea', async (ctx) => {
  await ctx.answerCbQuery('💡');
  const session = getSession(ctx.from!.id);
  await ctx.replyWithHTML('💡 <i>Генерирую...</i>');
  const r = await aiChat('Generate a creative startup idea in Russian.', PROMPTS.creative, session.model);
  await ctx.replyWithHTML(`💡 ${esc(r.substring(0, 3000))}`, Markup.inlineKeyboard([[Markup.button.callback('💡 Ещё', 'action_idea')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.action('action_joke', async (ctx) => {
  await ctx.answerCbQuery('😂');
  const session = getSession(ctx.from!.id);
  await ctx.replyWithHTML('😂 <i>Шучу...</i>');
  const r = await aiChat('Tell a short funny programming joke in Russian.', PROMPTS.creative, session.model);
  await ctx.replyWithHTML(`😂 ${esc(r.substring(0, 2000))}`, Markup.inlineKeyboard([[Markup.button.callback('😂 Ещё', 'action_joke')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.action('action_quote', async (ctx) => {
  const qs = [{ t: 'Лучший способ предсказать будущее — создать его.', a: 'Друкер' }, { t: 'Инновация отличает лидера от догоняющего.', a: 'Джобс' }, { t: 'AI не заменит людей. Люди с AI заменят людей без AI.', a: '—' }];
  const q = qs[Math.floor(Math.random() * qs.length)];
  await ctx.answerCbQuery('📖');
  await ctx.replyWithHTML(`📖 <i>"${esc(q.t)}"</i>\n— <b>${esc(q.a)}</b>`, Markup.inlineKeyboard([[Markup.button.callback('📖 Ещё', 'action_quote')], [Markup.button.callback('⬅️ Меню', 'back_start')]]));
});

bot.action('action_coin', async (ctx) => { await ctx.answerCbQuery('🪙'); await ctx.replyWithHTML(`🪙 ${Math.random() < 0.5 ? 'Орёл!' : 'Решка!'}`, Markup.inlineKeyboard([[Markup.button.callback('🪙 Ещё', 'action_coin')], [Markup.button.callback('⬅️ Меню', 'back_start')]])); });
bot.action('action_dice', async (ctx) => { await ctx.answerCbQuery('🎲'); await ctx.replyWithHTML(`🎲 ${Math.floor(Math.random() * 6) + 1}`); await ctx.replyWithDice(); });
bot.action('action_random', async (ctx) => { await ctx.answerCbQuery('🎲'); await ctx.replyWithHTML(`🎲 <code>${Math.floor(Math.random() * 100) + 1}</code>`, Markup.inlineKeyboard([[Markup.button.callback('🎲 Ещё', 'action_random')], [Markup.button.callback('⬅️ Меню', 'back_start')]])); });
bot.action('action_pass', async (ctx) => { await ctx.answerCbQuery('🔐'); const ch = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'; let pw = ''; for (let i = 0; i < 16; i++) pw += ch[Math.floor(Math.random() * ch.length)]; await ctx.replyWithHTML(`🔐 <code>${esc(pw)}</code>`, Markup.inlineKeyboard([[Markup.button.callback('🔐 Новый', 'action_pass')], [Markup.button.callback('⬅️ Меню', 'back_start')]])); });
bot.action('action_uuid', async (ctx) => { await ctx.answerCbQuery('🆔'); await ctx.replyWithHTML(`🆔 <code>${crypto.randomUUID()}</code>`, Markup.inlineKeyboard([[Markup.button.callback('🆔 Ещё', 'action_uuid')], [Markup.button.callback('⬅️ Меню', 'back_start')]])); });
bot.action('action_emoji', async (ctx) => { const es = ['😎', '🤖', '🚀', '🎉', '💎', '🔥', '⚡', '🌟', '🎨']; await ctx.answerCbQuery('😎'); await ctx.replyWithHTML(`${es[Math.floor(Math.random() * es.length)]}`, Markup.inlineKeyboard([[Markup.button.callback('😎 Ещё', 'action_emoji')], [Markup.button.callback('⬅️ Меню', 'back_start')]])); });
bot.action('action_mood', async (ctx) => { const ms = [{ e: '😄', m: 'Отличное!', a: 'Творить!' }, { e: '😎', m: 'Уверенное', a: 'Ты можешь всё!' }, { e: '🔥', m: 'Заряженное!', a: 'Вперёд!' }]; const m = ms[Math.floor(Math.random() * ms.length)]; await ctx.answerCbQuery('🎭'); await ctx.replyWithHTML(`${m.e} <b>${m.m}</b>\n<i>${m.a}</i>`, Markup.inlineKeyboard([[Markup.button.callback('🎭 Ещё', 'action_mood')], [Markup.button.callback('⬅️ Меню', 'back_start')]])); });

// ═══════════════════════════════════════
// TEXT HANDLER (AI mode — with auto-fallback)
// ═══════════════════════════════════════

bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  const session = getSession(ctx.from!.id);
  const mode = session.mode;
  const agentId = session.agent;
  const modelId = session.model;

  let systemPrompt = PROMPTS.default;
  if (mode === 'agent') {
    const agent = AI_AGENTS.find(a => a.id === agentId);
    if (agent) systemPrompt = agent.prompt;
  } else if (mode === 'super') {
    const agent = SUPER_AGENTS.find(a => a.id === agentId);
    if (agent) systemPrompt = agent.prompt;
  } else if (mode === 'openclaw') {
    systemPrompt = OPENCLAW_INFO.prompt;
  }

  const model = MODELS.find(m => m.id === modelId) || MODELS[0];
  await ctx.replyWithHTML(`${model.emoji} <i>Думаю через ${model.name}...</i>`);
  const resp = await aiChat(text, systemPrompt, modelId);
  await ctx.replyWithHTML(`<b>${model.emoji} AI:</b>\n\n${esc(resp.substring(0, 4000))}`, Markup.inlineKeyboard([
    [Markup.button.callback('🤖 Сменить модель', 'model_menu')],
    [Markup.button.callback('⬅️ Меню', 'back_start')],
  ]));
});

// ─── Error handler ───
bot.catch((err) => console.error('❌ Error:', err));

// ─── Launch ───
bot.launch();
console.log('🤖 Aisunio v5.1 launched — Multi-Model AI Super Agent');
console.log(`📊 Models: ${MODELS.length} | Agents: ${AI_AGENTS.length + SUPER_AGENTS.length + 1} | OpenClaw: ✅ | GitHub: ✅`);
console.log(`🧠 GitHub Models: ${GITHUB_TOKEN ? '✅ Connected' : '❌ No token'}`);
console.log('✅ Running 24/7...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
