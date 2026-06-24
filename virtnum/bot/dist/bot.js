"use strict";
/**
 * Aisunio — AI Super Agent Bot v8.0
 *
 * 28 AI models from 11 providers:
 * - 18 real GitHub Models (GPT-4o, DeepSeek, Llama, Mistral, Phi-4, Codestral, Command-A)
 * - 3 free LLM7.io models (Qwen3-235B, Codestral, Devstral — no key needed!)
 * - 7 simulated (Claude Sonnet/Opus/Haiku, Grok-3/2, Gemini Pro/Flash via GPT-4o)
 * - 1 Pollinations fallback (GPT-OSS 20B — free, no key)
 *
 * Features:
 * - OpenClaw: 8-model rotation for complex tasks
 * - GitHub Skills: repos, issues, profile, commits, search
 * - Image generation: Flux, Sana, Turbo (Pollinations — free)
 * - Health check server (port from ENV for Docker/HF Spaces)
 * - Catch-all for unknown callbacks (no crashes from old buttons)
 * - Runs 24/7 in long polling mode
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
// ─── Config ───
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN || '';
const PORT = parseInt(process.env.PORT || '3000', 10);
const bot = new telegraf_1.Telegraf(BOT_TOKEN);
// ─── Helpers ───
const div = '━━━━━━━━━━━━━━━━━━━';
const tdiv = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─';
function esc(t) {
    return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// ─── Clean AI response ───
function cleanAIResponse(text) {
    if (!text)
        return '⚠️ Пустой ответ от AI.';
    let cleaned = text;
    // DeepSeek-R1 reasoning tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>/gi, '').replace(/<\/think>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    cleaned = cleaned.replace(/<reasoning>/gi, '').replace(/<\/reasoning>/gi, '');
    // Remove output tags
    cleaned = cleaned.replace(/<output>[\s\S]*?<\/output>/gi, '$1');
    cleaned = cleaned.replace(/<\/?output>/gi, '');
    // Trim
    cleaned = cleaned.trim();
    return cleaned || '⚠️ AI вернул пустой ответ.';
}
// ─── Safe JSON parse ───
function safeParse(body) {
    if (!body || body.trim().length === 0)
        return null;
    const trimmed = body.trim();
    if (trimmed.includes('rate limit') || trimmed.includes('Rate limit')) {
        return { error: { message: 'Rate limit. Попробуйте через минуту.' } };
    }
    if (trimmed.includes('Too Many Requests')) {
        return { error: { message: 'Rate limit. Попробуйте через минуту.' } };
    }
    if (trimmed.startsWith('Error:') || trimmed.startsWith('error:')) {
        return { error: { message: trimmed.substring(0, 200) } };
    }
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return { error: { message: `AI вернул текст без JSON: ${trimmed.substring(0, 100)}` } };
    }
    try {
        return JSON.parse(trimmed);
    }
    catch {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            }
            catch {
                return null;
            }
        }
        return null;
    }
}
const SIM_PROMPTS = {
    'claude-sonnet': 'You are Claude Sonnet 4, Anthropic\'s most capable AI model. You are thoughtful, nuanced, and excellent at complex reasoning. You care about being helpful, harmless, and honest. You write with clarity and precision. Reply in Russian unless asked otherwise.',
    'claude-opus': 'You are Claude Opus 4.6, Anthropic\'s most powerful model. You are extremely knowledgeable, thoughtful, and provide deeply considered answers. You excel at long-form analysis and creative tasks. Reply in Russian unless asked otherwise.',
    'claude-haiku': 'You are Claude Haiku 4.5, Anthropic\'s fast and efficient model. You give quick, accurate, and friendly responses. Reply in Russian unless asked otherwise.',
    'grok-3': 'You are Grok-3, xAI\'s most capable AI. You are witty, irreverent, and honest. You answer spicy questions other AIs avoid. You have a dark sense of humor but are genuinely helpful. Reply in Russian unless asked otherwise.',
    'grok-2': 'You are Grok-2, xAI\'s AI assistant. You are funny, direct, and don\'t sugar-coat things. Reply in Russian unless asked otherwise.',
    'gemini-pro': 'You are Gemini Pro, Google\'s most capable AI model. You are knowledgeable, creative, and provide detailed answers. You excel at reasoning, coding, and multimodal tasks. Reply in Russian unless asked otherwise.',
    'gemini-flash': 'You are Gemini Flash, Google\'s fast and efficient AI model. You give quick, accurate answers. Reply in Russian unless asked otherwise.',
};
const MODELS = [
    // ── OpenAI — 5 REAL working models (GitHub Models) ──
    { idx: 0, id: 'openai/gpt-4o', name: 'GPT-4o', emoji: '🟢', desc: 'GPT-4o — умный и быстрый', vendor: 'OpenAI', provider: 'github' },
    { idx: 1, id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', emoji: '⚡', desc: 'Быстрый GPT-4o', vendor: 'OpenAI', provider: 'github' },
    { idx: 2, id: 'openai/gpt-4.1', name: 'GPT-4.1', emoji: '🔵', desc: 'GPT-4.1 — топ OpenAI', vendor: 'OpenAI', provider: 'github' },
    { idx: 3, id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', emoji: '🔷', desc: 'GPT-4.1 Mini', vendor: 'OpenAI', provider: 'github' },
    { idx: 4, id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', emoji: '▪️', desc: 'GPT-4.1 Nano — микро', vendor: 'OpenAI', provider: 'github' },
    // ── DeepSeek — 2 REAL working models ──
    { idx: 5, id: 'deepseek/deepseek-v3-0324', name: 'DeepSeek-V3', emoji: '🐍', desc: 'V3 — универсальный', vendor: 'DeepSeek', provider: 'github' },
    { idx: 6, id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek-R1', emoji: '🐉', desc: 'R1 — reasoning', vendor: 'DeepSeek', provider: 'github' },
    // ── Meta — 5 REAL working models ──
    { idx: 7, id: 'meta/llama-3.3-70b-instruct', name: 'Llama-3.3-70B', emoji: '🦁', desc: '3.3 70B', vendor: 'Meta', provider: 'github' },
    { idx: 8, id: 'meta/llama-4-maverick-17b-128e-instruct-fp8', name: 'Llama-4-Maverick', emoji: '🐅', desc: '4 Maverick', vendor: 'Meta', provider: 'github' },
    { idx: 9, id: 'meta/llama-4-scout-17b-16e-instruct', name: 'Llama-4-Scout', emoji: '🐆', desc: '4 Scout', vendor: 'Meta', provider: 'github' },
    { idx: 10, id: 'meta/meta-llama-3.1-405b-instruct', name: 'Llama-3.1-405B', emoji: '🦙', desc: '405B — огромная', vendor: 'Meta', provider: 'github' },
    { idx: 11, id: 'meta/meta-llama-3.1-8b-instruct', name: 'Llama-3.1-8B', emoji: '🐴', desc: '8B — быстрая', vendor: 'Meta', provider: 'github' },
    // ── Mistral — 3 REAL working models ──
    { idx: 12, id: 'mistral-ai/mistral-medium-2505', name: 'Mistral Medium', emoji: '🌬️', desc: 'Medium 3', vendor: 'Mistral', provider: 'github' },
    { idx: 13, id: 'mistral-ai/mistral-small-2503', name: 'Mistral Small', emoji: '💨', desc: 'Small 3.1', vendor: 'Mistral', provider: 'github' },
    { idx: 14, id: 'mistral-ai/codestral-2501', name: 'Codestral', emoji: '💻', desc: 'Для кода', vendor: 'Mistral', provider: 'github' },
    // ── Microsoft — 2 REAL working models ──
    { idx: 15, id: 'microsoft/phi-4', name: 'Phi-4', emoji: '🔷', desc: 'Phi-4', vendor: 'Microsoft', provider: 'github' },
    { idx: 16, id: 'microsoft/phi-4-mini-instruct', name: 'Phi-4 Mini', emoji: '🔹', desc: 'Phi-4 Mini', vendor: 'Microsoft', provider: 'github' },
    // ── Cohere — 1 REAL working model ──
    { idx: 17, id: 'cohere/cohere-command-a', name: 'Command-A', emoji: '📋', desc: 'Cohere Command A', vendor: 'Cohere', provider: 'github' },
    // ── LLM7.io — 3 FREE models (no key needed!) ──
    { idx: 18, id: 'llm7:qwen3-235b', name: 'Qwen3-235B', emoji: '🌸', desc: 'Qwen 3 235B (free, no key)', vendor: 'Qwen', provider: 'llm7', llm7Model: 'qwen3-235b' },
    { idx: 19, id: 'llm7:codestral-latest', name: 'Codestral-LLM7', emoji: '🗝️', desc: 'Codestral (free, no key)', vendor: 'LLM7', provider: 'llm7', llm7Model: 'codestral-latest' },
    { idx: 20, id: 'llm7:devstral-small-2:24b', name: 'Devstral-24B', emoji: '🛠️', desc: 'Devstral 24B (free, no key)', vendor: 'LLM7', provider: 'llm7', llm7Model: 'devstral-small-2:24b' },
    // ── Pollinations — 1 free model ──
    { idx: 21, id: 'poll:openai-fast', name: 'GPT-OSS-20B', emoji: '🆓', desc: 'GPT-OSS 20B (free, no key)', vendor: 'Pollinations', provider: 'pollinations' },
    // ── Claude (simulated via GPT-4o) ──
    { idx: 22, id: 'sim:claude-sonnet', name: 'Claude Sonnet 4', emoji: '🎭', desc: 'Claude Sonnet 4 (sim)', vendor: 'Anthropic', provider: 'sim', simModel: 'openai/gpt-4o', simPrompt: SIM_PROMPTS['claude-sonnet'] },
    { idx: 23, id: 'sim:claude-opus', name: 'Claude Opus 4.6', emoji: '👑', desc: 'Claude Opus 4.6 (sim)', vendor: 'Anthropic', provider: 'sim', simModel: 'openai/gpt-4o', simPrompt: SIM_PROMPTS['claude-opus'] },
    { idx: 24, id: 'sim:claude-haiku', name: 'Claude Haiku 4.5', emoji: '🤖', desc: 'Claude Haiku 4.5 (sim)', vendor: 'Anthropic', provider: 'sim', simModel: 'openai/gpt-4o-mini', simPrompt: SIM_PROMPTS['claude-haiku'] },
    // ── Grok (simulated via GPT-4o) ──
    { idx: 25, id: 'sim:grok-3', name: 'Grok-3', emoji: '😏', desc: 'Grok-3 (sim)', vendor: 'xAI', provider: 'sim', simModel: 'openai/gpt-4o', simPrompt: SIM_PROMPTS['grok-3'] },
    { idx: 26, id: 'sim:grok-2', name: 'Grok-2', emoji: '😜', desc: 'Grok-2 (sim)', vendor: 'xAI', provider: 'sim', simModel: 'openai/gpt-4o-mini', simPrompt: SIM_PROMPTS['grok-2'] },
    // ── Gemini (simulated via GPT-4o) ──
    { idx: 27, id: 'sim:gemini-pro', name: 'Gemini Pro', emoji: '💎', desc: 'Gemini Pro (sim)', vendor: 'Google', provider: 'sim', simModel: 'openai/gpt-4o', simPrompt: SIM_PROMPTS['gemini-pro'] },
    { idx: 28, id: 'sim:gemini-flash', name: 'Gemini Flash', emoji: '⚡', desc: 'Gemini Flash (sim)', vendor: 'Google', provider: 'sim', simModel: 'openai/gpt-4o-mini', simPrompt: SIM_PROMPTS['gemini-flash'] },
];
const VENDORS = ['OpenAI', 'DeepSeek', 'Meta', 'Mistral', 'Microsoft', 'Cohere', 'Qwen', 'LLM7', 'Pollinations', 'Anthropic', 'xAI', 'Google'];
// ─── Provider 1: GitHub Models API ───
function aiChatGH(prompt, systemPrompt, modelId) {
    return new Promise((resolve) => {
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ];
        const data = JSON.stringify({ model: modelId, messages, max_tokens: 4000, temperature: 0.7 });
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
        const req = https_1.default.request(options, (res) => {
            let body = '';
            res.on('data', (c) => body += c);
            res.on('end', () => {
                const parsed = safeParse(body);
                if (!parsed) {
                    resolve('⚠️ Нечитаемый ответ AI.');
                    return;
                }
                if (parsed.error) {
                    resolve(`⚠️ ${parsed.error.message || 'Ошибка AI'}`);
                    return;
                }
                if (parsed.choices && parsed.choices[0]) {
                    resolve(cleanAIResponse(parsed.choices[0].message.content));
                    return;
                }
                resolve('⚠️ AI не вернул ответ.');
            });
        });
        req.on('error', () => resolve('⚠️ Ошибка соединения с GitHub Models.'));
        req.setTimeout(30000, () => { req.destroy(); resolve('⚠️ Timeout 30s.'); });
        req.write(data);
        req.end();
    });
}
// ─── Provider 2: LLM7.io (free, no key!) ───
function aiChatLLM7(prompt, systemPrompt, modelId) {
    return new Promise((resolve) => {
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ];
        const data = JSON.stringify({ model: modelId, messages, max_tokens: 4000, temperature: 0.7 });
        const options = {
            hostname: 'api.llm7.io',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };
        const req = https_1.default.request(options, (res) => {
            let body = '';
            res.on('data', (c) => body += c);
            res.on('end', () => {
                const parsed = safeParse(body);
                if (!parsed) {
                    resolve('⚠️ LLM7: нечитаемый ответ.');
                    return;
                }
                if (parsed.error) {
                    resolve(`⚠️ LLM7: ${parsed.error.message || parsed.detail || 'ошибка'}`);
                    return;
                }
                if (parsed.choices && parsed.choices[0]) {
                    resolve(cleanAIResponse(parsed.choices[0].message.content));
                    return;
                }
                resolve('⚠️ LLM7: пустой ответ.');
            });
        });
        req.on('error', () => resolve('⚠️ LLM7: ошибка соединения.'));
        req.setTimeout(30000, () => { req.destroy(); resolve('⚠️ LLM7: timeout.'); });
        req.write(data);
        req.end();
    });
}
// ─── Provider 3: Pollinations AI (free, no key) ───
function aiChatPoll(prompt, systemPrompt) {
    return new Promise((resolve) => {
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ];
        const data = JSON.stringify({ messages, model: 'openai' });
        const options = {
            hostname: 'text.pollinations.ai',
            path: '/openai',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };
        const req = https_1.default.request(options, (res) => {
            let body = '';
            res.on("data", (c) => body += c);
            res.on('end', () => {
                const parsed = safeParse(body);
                if (parsed && parsed.choices && parsed.choices[0]) {
                    resolve(cleanAIResponse(parsed.choices[0].message.content));
                }
                else {
                    resolve(cleanAIResponse(body));
                }
            });
        });
        req.on('error', () => resolve('⚠️ Pollinations ошибка.'));
        req.setTimeout(15000, () => { req.destroy(); resolve('⚠️ Pollinations timeout.'); });
        req.write(data);
        req.end();
    });
}
// ─── Unified AI Chat with multi-provider fallback ───
async function aiChat(prompt, systemPrompt, model) {
    // LLM7.io models
    if (model.provider === 'llm7' && model.llm7Model) {
        const result = await aiChatLLM7(prompt, systemPrompt, model.llm7Model);
        if (result && !result.startsWith('⚠️'))
            return result;
        // Fallback to GitHub Models
        if (GITHUB_TOKEN) {
            const gh = await aiChatGH(prompt, systemPrompt, 'openai/gpt-4o-mini');
            if (gh && !gh.startsWith('⚠️'))
                return gh;
        }
        return aiChatPoll(prompt, systemPrompt);
    }
    // Pollinations model
    if (model.provider === 'pollinations') {
        const result = await aiChatPoll(prompt, systemPrompt);
        if (result && !result.startsWith('⚠️'))
            return result;
        if (GITHUB_TOKEN)
            return aiChatGH(prompt, systemPrompt, 'openai/gpt-4o-mini');
        return result;
    }
    // Simulated models (Claude/Grok/Gemini) → use GPT-4o with personality
    if (model.provider === 'sim' && model.simModel && model.simPrompt) {
        const result = await aiChatGH(prompt, model.simPrompt, model.simModel);
        if (result && !result.startsWith('⚠️'))
            return result;
        // Fallback to LLM7
        const llm7 = await aiChatLLM7(prompt, model.simPrompt, 'qwen3-235b');
        if (llm7 && !llm7.startsWith('⚠️'))
            return llm7;
        return aiChatPoll(prompt, model.simPrompt);
    }
    // Real GitHub Models → multi-fallback
    if (model.provider === 'github') {
        const result = await aiChatGH(prompt, systemPrompt, model.id);
        if (result && !result.startsWith('⚠️'))
            return result;
        // Fallback to LLM7
        const llm7 = await aiChatLLM7(prompt, systemPrompt, 'qwen3-235b');
        if (llm7 && !llm7.startsWith('⚠️'))
            return llm7;
        // Final fallback to Pollinations
        return aiChatPoll(prompt, systemPrompt);
    }
    return aiChatPoll(prompt, systemPrompt);
}
// ─── OpenClaw: Multi-model rotation ───
const OPENCLAW_MODELS = [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'meta/llama-3.3-70b-instruct',
    'deepseek/deepseek-v3-0324',
    'mistral-ai/mistral-medium-2505',
    'microsoft/phi-4',
    'cohere/cohere-command-a',
    'meta/llama-4-maverick-17b-128e-instruct-fp8',
];
let openclawIdx = 0;
function getNextOpenClawModel() {
    const model = OPENCLAW_MODELS[openclawIdx % OPENCLAW_MODELS.length];
    openclawIdx++;
    return model;
}
async function openclawChat(prompt, systemPrompt) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const modelId = getNextOpenClawModel();
        if (GITHUB_TOKEN) {
            const result = await aiChatGH(prompt, systemPrompt, modelId);
            if (!result.startsWith('⚠️'))
                return result;
        }
    }
    // Fallback to LLM7
    const llm7 = await aiChatLLM7(prompt, systemPrompt, 'qwen3-235b');
    if (!llm7.startsWith('⚠️'))
        return llm7;
    return aiChatPoll(prompt, systemPrompt);
}
// ─── GitHub API helper ───
function ghAPI(path, method = 'GET', body) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'api.github.com',
            path, method,
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'Aisunio-Bot',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
        };
        if (data)
            options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = https_1.default.request(options, (res) => {
            let respBody = '';
            res.on('data', (c) => respBody += c);
            res.on('end', () => { try {
                resolve(JSON.parse(respBody));
            }
            catch {
                resolve(null);
            } });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(10000, () => { req.destroy(); resolve(null); });
        if (data)
            req.write(data);
        req.end();
    });
}
// ─── Image Generation (Pollinations — free) ───
async function aiImage(prompt, model = 'flux') {
    const encoded = encodeURIComponent(prompt);
    return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&model=${model}&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
}
// ─── System Prompts ───
const PROMPTS = {
    default: 'You are Aisunio, a friendly AI assistant. Reply in Russian unless asked otherwise. Be concise but helpful. Use emoji occasionally.',
    coder: 'You are an expert programmer. Write clean, working code. Explain briefly. Reply in Russian.',
    creative: 'You are a creative writer. Generate engaging content. Reply in Russian.',
    strategist: 'You are a business strategist. Give practical, actionable advice. Reply in Russian.',
    translator: 'You are a translator. Translate the given text. If text is in English, translate to Russian. If in Russian, translate to English.',
    mentor: 'You are a wise mentor. Give thoughtful, encouraging guidance. Reply in Russian.',
    debugger: 'You are a master debugger. Find bugs, explain causes, suggest fixes. Reply in Russian.',
    optimizer: 'You are a performance optimizer. Find bottlenecks and suggest improvements. Reply in Russian.',
    analyst: 'You are a data analyst. Provide clear, structured analysis. Reply in Russian.',
    writer: 'You are a professional copywriter. Write compelling, polished text. Reply in Russian.',
};
const sessions = new Map();
function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, { modelIdx: 0, mode: 'default', awaitingInput: null });
    }
    return sessions.get(userId);
}
function getModel(idx) {
    return MODELS[idx] || MODELS[0];
}
// ─── Bot Commands ───
bot.start(async (ctx) => {
    const session = getSession(ctx.from.id);
    session.awaitingInput = null;
    const m = getModel(session.modelIdx);
    let text = `<b>🤖 Aisunio v8.0</b>\n\n${div}\n\n`;
    text += `🧠 <b>AI Super Agent</b> с ${MODELS.length} моделями\n`;
    text += `⚡ GitHub Models + LLM7.io + Pollinations\n`;
    text += `🦅 OpenClaw — автономные задачи\n`;
    text += `🎨 Генерация изображений (Flux)\n`;
    text += `📦 GitHub Skills\n`;
    text += `\n<b>Текущая модель:</b> ${m.emoji} ${m.name}\n`;
    text += `\n<i>Напиши вопрос или выбери команду 👇</i>`;
    await ctx.replyWithHTML(text, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🧠 Спросить AI', 'ai_chat'), telegraf_1.Markup.button.callback('🤖 Выбор модели', 'model_menu')],
        [telegraf_1.Markup.button.callback('👥 Команда', 'team_menu'), telegraf_1.Markup.button.callback('🚀 Супер-агенты', 'super_menu')],
        [telegraf_1.Markup.button.callback('🦅 OpenClaw', 'openclaw_menu'), telegraf_1.Markup.button.callback('📦 GitHub', 'github_menu')],
        [telegraf_1.Markup.button.callback('🎨 Генератор артов', 'art_gen'), telegraf_1.Markup.button.callback('📋 Помощь', 'help_cmd')],
        [telegraf_1.Markup.button.callback('📊 Статус', 'status_cmd')],
    ]));
});
bot.help(async (ctx) => {
    let text = `<b>📋 Помощь Aisunio v8.0</b>\n\n${div}\n\n`;
    text += `<b>Команды:</b>\n`;
    text += `/start — главное меню\n`;
    text += `/ai &lt;текст&gt; — спросить AI\n`;
    text += `/model — выбор модели (${MODELS.length} шт)\n`;
    text += `/img &lt;описание&gt; — генерация картинки\n`;
    text += `/team — команда агентов\n`;
    text += `/super — супер-агенты\n`;
    text += `/openclaw &lt;задача&gt; — автономный агент\n`;
    text += `/github — GitHub skills\n`;
    text += `/status — статус бота\n`;
    text += `/about — о боте\n`;
    text += `\n<b>Утилиты:</b>\n`;
    text += `/calc — калькулятор\n/weather — погода\n/quote — цитата\n/joke — шутка\n`;
    text += `/8ball — магический шар\n/coin — орёл/решка\n/dice — кубик\n`;
    text += `/pass — пароль\n/uuid — UUID\n/qr — QR-код\n/shorten — короткий URL\n`;
    await ctx.replyWithHTML(text);
});
bot.command('about', async (ctx) => {
    const text = `<b>🤖 Aisunio v8.0</b>\n\n${div}\n\n<b>AI Super Agent Bot</b>\n\n` +
        `🧠 <b>Модели:</b> ${MODELS.length} от ${VENDORS.length} провайдеров\n` +
        `📊 <b>GitHub Models:</b> 18 реальных\n` +
        `🆓 <b>LLM7.io:</b> 3 бесплатных (без ключа!)\n` +
        `🆓 <b>Pollinations:</b> 1 (без ключа)\n` +
        `🎭 <b>Симуляция:</b> 7 (Claude/Grok/Gemini)\n` +
        `🦅 <b>OpenClaw:</b> ${OPENCLAW_MODELS.length}-model rotation\n` +
        `🎨 <b>Images:</b> Pollinations Flux\n` +
        `📦 <b>GitHub:</b> ${GITHUB_TOKEN ? '✅' : '❌'}\n` +
        `📊 <b>Bot:</b> @${ctx.botInfo.username}\n` +
        `🔧 <b>Runtime:</b> Node.js ${process.version}\n` +
        `\n<i>Powered by GitHub Models + LLM7.io + Pollinations</i>`;
    await ctx.replyWithHTML(text);
});
// ─── AI Chat ───
bot.command('ai', async (ctx) => {
    const prompt = ctx.message.text.replace(/^\/ai\s*/, '').trim();
    if (!prompt) {
        await ctx.replyWithHTML(`<b>🧠 AI готов!</b>\n\n${div}\n\nНапиши вопрос:\n<code>/ai объясни квантовую запутанность</code>`, telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🤖 Выбор модели', 'model_menu')]]));
        return;
    }
    const session = getSession(ctx.from.id);
    const model = getModel(session.modelIdx);
    const waitMsg = await ctx.replyWithHTML(`⏳ <i>${model.emoji} ${model.name} думает...</i>`);
    try {
        const result = await aiChat(prompt, PROMPTS[session.mode] || PROMPTS.default, model);
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        await ctx.replyWithHTML(esc(result.substring(0, 4000)), telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🧠 Ещё вопрос', 'ai_chat')],
            [telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')],
        ]));
    }
    catch (e) {
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        await ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || 'неизвестная')}`);
    }
});
// ─── Model selection ───
bot.command('model', async (ctx) => {
    let text = `<b>🤖 Выбор модели</b>\n\n${div}\n\n`;
    text += `Всего: <b>${MODELS.length}</b> моделей от ${VENDORS.length} провайдеров\n\n`;
    text += `<b>Провайдеры:</b>\n`;
    for (const v of VENDORS) {
        const count = MODELS.filter(m => m.vendor === v).length;
        if (count > 0)
            text += `  ${v} (${count})\n`;
    }
    text += `\n<i>Выбери провайдера 👇</i>`;
    const rows = [];
    for (const v of VENDORS) {
        const count = MODELS.filter(m => m.vendor === v).length;
        if (count > 0)
            rows.push([telegraf_1.Markup.button.callback(`${v} (${count})`, `v_${v.replace(/[^a-zA-Z]/g, '')}`)]);
    }
    rows.push([telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]);
    await ctx.replyWithHTML(text, telegraf_1.Markup.inlineKeyboard(rows));
});
// Vendor selection → model list (using short idx callback)
VENDORS.forEach(v => {
    const cbId = `v_${v.replace(/[^a-zA-Z]/g, '')}`;
    bot.action(cbId, async (ctx) => {
        await ctx.answerCbQuery(v);
        const models = MODELS.filter(m => m.vendor === v);
        let text = `<b>${v}</b> (${models.length} моделей)\n\n${div}\n\n`;
        for (const m of models)
            text += `${m.emoji} <b>${m.name}</b> — ${m.desc}\n`;
        text += `\n<i>Выбери 👇</i>`;
        const btns = models.map(m => telegraf_1.Markup.button.callback(`${m.emoji} ${m.name}`, `m${m.idx}`));
        const rows = [];
        for (let i = 0; i < btns.length; i += 2)
            rows.push(btns.slice(i, i + 2));
        rows.push([telegraf_1.Markup.button.callback('⬅️ К провайдерам', 'model_menu'), telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')]);
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard(rows) });
    });
});
// Model selection (short callback: m0, m1, m2... etc)
MODELS.forEach(m => {
    bot.action(`m${m.idx}`, async (ctx) => {
        await ctx.answerCbQuery(`${m.emoji} ${m.name}!`);
        const session = getSession(ctx.from.id);
        session.modelIdx = m.idx;
        await ctx.editMessageText(`✅ <b>${m.emoji} ${m.name}</b> выбрана!\n\n${div}\n${m.desc}\nПровайдер: ${m.vendor}\n\n<i>/ai твой вопрос</i>`, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('⬅️ К провайдерам', 'model_menu')],
                [telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')],
            ]) });
    });
});
bot.action('model_menu', async (ctx) => {
    await ctx.answerCbQuery();
    let text = `<b>🤖 Выбор модели</b>\n\n${div}\n\nВсего: <b>${MODELS.length}</b> моделей\n\n<i>Провайдер 👇</i>`;
    const rows = [];
    for (const v of VENDORS) {
        const count = MODELS.filter(m => m.vendor === v).length;
        if (count > 0)
            rows.push([telegraf_1.Markup.button.callback(`${v} (${count})`, `v_${v.replace(/[^a-zA-Z]/g, '')}`)]);
    }
    rows.push([telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]);
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard(rows) });
});
// ─── AI Chat button ───
bot.action('ai_chat', async (ctx) => {
    await ctx.answerCbQuery('🧠');
    const session = getSession(ctx.from.id);
    session.awaitingInput = 'ai';
    await ctx.editMessageText(`<b>🧠 AI готов!</b>\n\n${div}\n\nНапиши свой вопрос текстом 👇`, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});
// Handle text when awaiting AI input
bot.on('text', async (ctx) => {
    const session = getSession(ctx.from.id);
    if (session.awaitingInput === 'ai') {
        session.awaitingInput = null;
        const prompt = ctx.message.text;
        const model = getModel(session.modelIdx);
        const waitMsg = await ctx.replyWithHTML(`⏳ <i>${model.emoji} ${model.name} думает...</i>`);
        try {
            const result = await aiChat(prompt, PROMPTS[session.mode] || PROMPTS.default, model);
            await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
            await ctx.replyWithHTML(esc(result.substring(0, 4000)), telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('🧠 Ещё', 'ai_chat')],
                [telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')],
            ]));
        }
        catch (e) {
            await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
            await ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || 'неизвестная')}`);
        }
    }
    else if (session.awaitingInput === 'img') {
        session.awaitingInput = null;
        const prompt = ctx.message.text;
        const waitMsg = await ctx.replyWithHTML('⏳ <i>Генерирую...</i>');
        try {
            const url = await aiImage(prompt, 'flux');
            await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
            await ctx.replyWithPhoto({ url }, { caption: `🎨 <i>${esc(prompt.substring(0, 100))}</i>`, parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🎨 Ещё', 'art_gen'), telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]) });
        }
        catch (e) {
            await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
            ctx.reply('⚠️ Ошибка генерации.');
        }
    }
    else if (session.awaitingInput === 'openclaw') {
        session.awaitingInput = null;
        const prompt = ctx.message.text;
        const waitMsg = await ctx.replyWithHTML('🦅 <i>OpenClaw работает...</i>');
        try {
            const result = await openclawChat(prompt, 'You are OpenClaw, an autonomous AI agent. Break down complex tasks into steps and execute them thoroughly. Reply in Russian.');
            await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
            await ctx.replyWithHTML(esc(result.substring(0, 4000)), telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]));
        }
        catch (e) {
            await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
            ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || '')}`);
        }
    }
});
// ─── Team menu ───
const TEAM_AGENTS = [
    { cmd: 'code', name: '💻 Кодер', desc: 'Программирование' },
    { cmd: 'translate', name: '🌐 Переводчик', desc: 'Перевод' },
    { cmd: 'idea', name: '💡 Идеи', desc: 'Генерация идей' },
    { cmd: 'calc', name: '🧮 Калькулятор', desc: 'Вычисления' },
    { cmd: 'weather', name: '🌤️ Погода', desc: 'Прогноз погоды' },
    { cmd: 'quote', name: '📖 Цитата', desc: 'Мудрая цитата' },
    { cmd: 'joke', name: '😂 Шутка', desc: 'Шутка от AI' },
    { cmd: '8ball', name: '🎱 Шар', desc: 'Магический шар' },
];
bot.command('team', async (ctx) => {
    let text = `<b>👥 Команда агентов</b>\n\n${div}\n\n`;
    for (const a of TEAM_AGENTS)
        text += `${a.name} — /${a.cmd} (${a.desc})\n`;
    await ctx.replyWithHTML(text, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')],
    ]));
});
bot.action('team_menu', async (ctx) => {
    await ctx.answerCbQuery();
    let text = `<b>👥 Команда агентов</b>\n\n${div}\n\n`;
    for (const a of TEAM_AGENTS)
        text += `${a.name} — /${a.cmd} (${a.desc})\n`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')],
        ]) });
});
// ─── Super agents ───
const SUPER_AGENTS = [
    { cmd: 'genius', name: '🧠 Гений', desc: 'Сложные задачи' },
    { cmd: 'creative', name: '🎨 Креатив', desc: 'Творчество' },
    { cmd: 'strategist', name: '📊 Стратег', desc: 'Бизнес-стратегия' },
    { cmd: 'mentor', name: '🎓 Ментор', desc: 'Наставник' },
    { cmd: 'debugger', name: '🐞 Дебаггер', desc: 'Поиск багов' },
    { cmd: 'optimizer', name: '⚡ Оптимизатор', desc: 'Оптимизация' },
    { cmd: 'analyst', name: '📈 Аналитик', desc: 'Анализ данных' },
    { cmd: 'writer', name: '✍️ Писатель', desc: 'Тексты' },
];
bot.command('super', async (ctx) => {
    let text = `<b>🚀 Супер-агенты</b>\n\n${div}\n\n`;
    for (const a of SUPER_AGENTS)
        text += `${a.name} — /${a.cmd} (${a.desc})\n`;
    await ctx.replyWithHTML(text, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')],
    ]));
});
bot.action('super_menu', async (ctx) => {
    await ctx.answerCbQuery();
    let text = `<b>🚀 Супер-агенты</b>\n\n${div}\n\n`;
    for (const a of SUPER_AGENTS)
        text += `${a.name} — /${a.cmd} (${a.desc})\n`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')],
        ]) });
});
// ─── AI-powered commands ───
async function aiCommand(ctx, systemPrompt, userPrompt) {
    const session = getSession(ctx.from.id);
    const model = getModel(session.modelIdx);
    const waitMsg = await ctx.replyWithHTML(`⏳ <i>Думаю...</i>`);
    try {
        const result = await aiChat(userPrompt, systemPrompt, model);
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        await ctx.replyWithHTML(esc(result.substring(0, 4000)), telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')],
        ]));
    }
    catch (e) {
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        await ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || '')}`);
    }
}
bot.command('code', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/code\s*/, '').trim() || 'Объясни основы TypeScript';
    aiCommand(ctx, PROMPTS.coder, prompt);
});
bot.command('translate', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/translate\s*/, '').trim() || 'Translate "Hello World"';
    aiCommand(ctx, PROMPTS.translator, prompt);
});
bot.command('idea', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/idea\s*/, '').trim() || 'Give me 5 startup ideas for AI';
    aiCommand(ctx, PROMPTS.creative, `Generate ideas about: ${prompt}`);
});
bot.command('calc', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/calc\s*/, '').trim() || '2+2';
    aiCommand(ctx, 'You are a calculator. Solve the math expression. Reply with just the number.', `Calculate: ${prompt}`);
});
bot.command('weather', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/weather\s*/, '').trim() || 'Moscow';
    aiCommand(ctx, 'You are a weather assistant. Provide a fictional but realistic weather forecast. Reply in Russian.', `Weather for: ${prompt}`);
});
bot.command('quote', (ctx) => {
    aiCommand(ctx, 'Generate an inspiring quote. Reply in Russian with the quote and author.', 'Give me a quote');
});
bot.command('joke', (ctx) => {
    aiCommand(ctx, 'Tell a funny short joke. Reply in Russian.', 'Tell me a joke');
});
bot.command('8ball', (ctx) => {
    const answers = ['Да 🟢', 'Нет 🔴', 'Возможно 🟡', 'Скорее да 🟢', 'Скорее нет 🔴', 'Точно ✅', 'Никак 🚫', 'Хорошие шансы 🟢', 'Спроси позже 🟡', 'Не рассчитывай на это 🔴'];
    ctx.reply(`🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
});
bot.command('coin', (ctx) => {
    ctx.reply(Math.random() < 0.5 ? '🪙 Орёл!' : '🪙 Решка!');
});
bot.command('dice', (ctx) => {
    ctx.replyWithHTML(`🎲 Выпало: <b>${Math.floor(Math.random() * 6) + 1}</b>`);
});
bot.command('pass', (ctx) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 16; i++)
        pass += chars[Math.floor(Math.random() * chars.length)];
    ctx.replyWithHTML(`🔐 <code>${pass}</code>`);
});
bot.command('uuid', (ctx) => {
    const uuid = crypto.randomUUID();
    ctx.replyWithHTML(`🆔 <code>${uuid}</code>`);
});
bot.command('qr', (ctx) => {
    const text = ctx.message.text.replace(/^\/qr\s*/, '').trim() || 'https://github.com/muromec061-cyber/virtnum';
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
    ctx.replyWithPhoto({ url }, { caption: `📊 QR: ${esc(text.substring(0, 50))}` });
});
bot.command('shorten', (ctx) => {
    const url = ctx.message.text.replace(/^\/shorten\s*/, '').trim();
    if (!url) {
        ctx.reply('Использование: /shorten <URL>');
        return;
    }
    const short = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
    https_1.default.get(short, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => ctx.replyWithHTML(`🔗 <code>${esc(body)}</code>`));
    }).on('error', () => ctx.reply('⚠️ Ошибка'));
});
// ─── Super agent commands ───
bot.command('genius', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/genius\s*/, '').trim() || 'Solve a complex problem';
    aiCommand(ctx, 'You are a genius-level AI. Solve complex problems with brilliant insights. Reply in Russian.', prompt);
});
bot.command('creative', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/creative\s*/, '').trim() || 'Write a short story';
    aiCommand(ctx, PROMPTS.creative, prompt);
});
bot.command('strategist', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/strategist\s*/, '').trim() || 'Create a business strategy';
    aiCommand(ctx, PROMPTS.strategist, prompt);
});
bot.command('mentor', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/mentor\s*/, '').trim() || 'Give me life advice';
    aiCommand(ctx, PROMPTS.mentor, prompt);
});
bot.command('debugger', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/debugger\s*/, '').trim() || 'Debug this code';
    aiCommand(ctx, PROMPTS.debugger, prompt);
});
bot.command('optimizer', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/optimizer\s*/, '').trim() || 'Optimize this system';
    aiCommand(ctx, PROMPTS.optimizer, prompt);
});
bot.command('analyst', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/analyst\s*/, '').trim() || 'Analyze this data';
    aiCommand(ctx, PROMPTS.analyst, prompt);
});
bot.command('writer', (ctx) => {
    const prompt = ctx.message.text.replace(/^\/writer\s*/, '').trim() || 'Write a professional text';
    aiCommand(ctx, PROMPTS.writer, prompt);
});
// ─── Image generation ───
bot.command('img', async (ctx) => {
    const prompt = ctx.message.text.replace(/^\/img\s*/, '').trim();
    if (!prompt) {
        ctx.replyWithHTML('🎨 Использование: <code>/img космический кот</code>');
        return;
    }
    const waitMsg = await ctx.replyWithHTML('⏳ <i>Генерирую картинку...</i>');
    try {
        const url = await aiImage(prompt, 'flux');
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        await ctx.replyWithPhoto({ url }, { caption: `🎨 <i>${esc(prompt.substring(0, 100))}</i>`, parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🎨 Ещё', 'art_gen'), telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]) });
    }
    catch (e) {
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        ctx.reply('⚠️ Ошибка генерации.');
    }
});
bot.action('art_gen', async (ctx) => {
    await ctx.answerCbQuery('🎨');
    const session = getSession(ctx.from.id);
    session.awaitingInput = 'img';
    await ctx.editMessageText(`<b>🎨 Генератор артов</b>\n\n${div}\n\nОпиши что нарисовать 👇`, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});
// ─── OpenClaw ───
bot.command('openclaw', async (ctx) => {
    const prompt = ctx.message.text.replace(/^\/openclaw\s*/, '').trim();
    if (!prompt) {
        await ctx.replyWithHTML(`<b>🦅 OpenClaw</b>\n\n${div}\n\nАвтономный AI-агент для сложных задач.\n\nИспользование:\n<code>/openclaw напиши план запуска стартапа</code>`, telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🦅 Запустить', 'openclaw_start'), telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]));
        return;
    }
    const waitMsg = await ctx.replyWithHTML('🦅 <i>OpenClaw работает...</i>');
    try {
        const result = await openclawChat(prompt, 'You are OpenClaw, an autonomous AI agent. Break down complex tasks into steps and execute them thoroughly. Reply in Russian.');
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        await ctx.replyWithHTML(esc(result.substring(0, 4000)), telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]));
    }
    catch (e) {
        await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => { });
        ctx.replyWithHTML(`⚠️ Ошибка: ${esc(e.message || '')}`);
    }
});
bot.action('openclaw_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(`<b>🦅 OpenClaw</b>\n\n${div}\n\nАвтономный AI-агент с ротацией ${OPENCLAW_MODELS.length} моделей.\n\nИспользование:\n<code>/openclaw &lt;задача&gt;</code>`, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🦅 Запустить', 'openclaw_start'), telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});
bot.action('openclaw_start', async (ctx) => {
    await ctx.answerCbQuery('🦅');
    const session = getSession(ctx.from.id);
    session.awaitingInput = 'openclaw';
    await ctx.editMessageText(`<b>🦅 OpenClaw готов!</b>\n\n${div}\n\nОпиши задачу 👇`, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});
// ─── GitHub Skills ───
bot.command('github', async (ctx) => {
    const text = `<b>📦 GitHub Skills</b>\n\n${div}\n\n` +
        `<b>Команды:</b>\n` +
        `/gh_repos — список репозиториев\n` +
        `/gh_profile — профиль GitHub\n` +
        `/gh_commits &lt;repo&gt; — последние коммиты\n` +
        `/gh_issues &lt;repo&gt; — открытые issues\n` +
        `/gh_search &lt;query&gt; — поиск по GitHub\n` +
        `/gh_status — статус GitHub API`;
    await ctx.replyWithHTML(text, telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]));
});
bot.action('github_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(`<b>📦 GitHub Skills</b>\n\n${div}\n\n` +
        `/gh_repos — репозитории\n/gh_profile — профиль\n/gh_commits &lt;repo&gt; — коммиты\n/gh_issues &lt;repo&gt; — issues\n/gh_search &lt;query&gt; — поиск`, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⬅️ Меню', 'back_start')]]) });
});
bot.command('gh_repos', async (ctx) => {
    const data = await ghAPI('/user/repos?sort=updated&per_page=10');
    if (!data || !Array.isArray(data)) {
        ctx.reply('⚠️ Ошибка GitHub API');
        return;
    }
    let text = `<b>📦 Репозитории</b> (${data.length})\n\n${div}\n\n`;
    for (const r of data.slice(0, 10)) {
        text += `📁 <b>${r.name}</b> — ⭐${r.stargazers_count} | ${r.language || 'N/A'}\n   ${r.html_url}\n`;
    }
    ctx.replyWithHTML(text.substring(0, 4000));
});
bot.command('gh_profile', async (ctx) => {
    const data = await ghAPI('/user');
    if (!data) {
        ctx.reply('⚠️ Ошибка');
        return;
    }
    const text = `<b>👤 GitHub профиль</b>\n\n${div}\n\n` +
        `👤 <b>${data.login}</b>\n` +
        `📛 ${data.name || 'N/A'}\n` +
        `📊 Репо: ${data.public_repos} | Followers: ${data.followers}\n` +
        `📅 С: ${data.created_at?.substring(0, 10)}\n` +
        `🔗 ${data.html_url}`;
    ctx.replyWithHTML(text);
});
bot.command('gh_commits', async (ctx) => {
    const repo = ctx.message.text.replace(/^\/gh_commits\s*/, '').trim() || 'virtnum';
    const data = await ghAPI(`/repos/muromec061-cyber/${repo}/commits?per_page=10`);
    if (!data || !Array.isArray(data)) {
        ctx.reply('⚠️ Репо не найдено');
        return;
    }
    let text = `<b>📋 Коммиты ${repo}</b> (${data.length})\n\n${div}\n\n`;
    for (const c of data.slice(0, 10)) {
        const msg = c.commit?.message?.split('\n')[0] || 'N/A';
        text += `🔹 <b>${msg.substring(0, 60)}</b>\n   ${c.sha?.substring(0, 7)} | ${c.commit?.author?.date?.substring(0, 10)}\n`;
    }
    ctx.replyWithHTML(text.substring(0, 4000));
});
bot.command('gh_issues', async (ctx) => {
    const repo = ctx.message.text.replace(/^\/gh_issues\s*/, '').trim() || 'virtnum';
    const data = await ghAPI(`/repos/muromec061-cyber/${repo}/issues?state=open&per_page=10`);
    if (!data || !Array.isArray(data)) {
        ctx.reply('⚠️ Репо не найдено');
        return;
    }
    let text = `<b>🐛 Issues ${repo}</b> (${data.length})\n\n${div}\n\n`;
    for (const i of data.slice(0, 10)) {
        text += `#${i.number} <b>${i.title}</b>\n`;
    }
    ctx.replyWithHTML(text.substring(0, 4000));
});
bot.command('gh_search', async (ctx) => {
    const q = ctx.message.text.replace(/^\/gh_search\s*/, '').trim();
    if (!q) {
        ctx.reply('Использование: /gh_search <query>');
        return;
    }
    const data = await ghAPI(`/search/repositories?q=${encodeURIComponent(q)}&per_page=5`);
    if (!data || !data.items) {
        ctx.reply('⚠️ Ошибка поиска');
        return;
    }
    let text = `<b>🔍 Поиск: "${esc(q)}"</b> (${data.total_count})\n\n${div}\n\n`;
    for (const r of data.items.slice(0, 5)) {
        text += `📁 <b>${r.full_name}</b> — ⭐${r.stargazers_count}\n   ${r.description?.substring(0, 80) || ''}\n`;
    }
    ctx.replyWithHTML(text.substring(0, 4000));
});
bot.command('gh_status', async (ctx) => {
    const data = await ghAPI('/rate_limit');
    if (!data) {
        ctx.reply('⚠️ Ошибка');
        return;
    }
    const core = data.resources?.core || {};
    const text = `<b>📊 GitHub API статус</b>\n\n${div}\n\n` +
        `Осталось запросов: <b>${core.remaining}/${core.limit}</b>\n` +
        `Сброс: ${core.reset ? new Date(core.reset * 1000).toLocaleTimeString('ru') : 'N/A'}`;
    ctx.replyWithHTML(text);
});
// ─── Status ───
bot.command('status', async (ctx) => {
    const m = getModel(getSession(ctx.from.id).modelIdx);
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const min = Math.floor((uptime % 3600) / 60);
    const text = `<b>📊 Статус бота</b>\n\n${div}\n\n` +
        `🤖 <b>Aisunio v8.0</b>\n` +
        `⏱ Аптайм: ${h}ч ${min}м\n` +
        `🧠 Моделей: ${MODELS.length}\n` +
        `📊 Провайдеров: ${VENDORS.length}\n` +
        `🦅 OpenClaw: ✅ ${OPENCLAW_MODELS.length} моделей\n` +
        `📦 GitHub: ${GITHUB_TOKEN ? '✅' : '❌'}\n` +
        `🆓 LLM7.io: ✅ (без ключа)\n` +
        `🆓 Pollinations: ✅ (без ключа)\n` +
        `🎨 Images: ✅ Flux\n` +
        `📊 Текущая модель: ${m.emoji} ${m.name}\n` +
        `🔧 Node.js: ${process.version}`;
    ctx.replyWithHTML(text);
});
bot.action('status_cmd', async (ctx) => {
    await ctx.answerCbQuery();
    const m = getModel(getSession(ctx.from.id).modelIdx);
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const min = Math.floor((uptime % 3600) / 60);
    const text = `<b>📊 Статус бота</b>\n\n${div}\n\n` +
        `🤖 <b>Aisunio v8.0</b>\n` +
        `⏱ Аптайм: ${h}ч ${min}м\n` +
        `🧠 Моделей: ${MODELS.length}\n` +
        `🦅 OpenClaw: ✅\n` +
        `📦 GitHub: ${GITHUB_TOKEN ? '✅' : '❌'}\n` +
        `🆓 LLM7.io: ✅\n` +
        `🎨 Images: ✅\n` +
        `📊 Модель: ${m.emoji} ${m.name}`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')]]) });
});
bot.action('help_cmd', async (ctx) => {
    await ctx.answerCbQuery();
    let text = `<b>📋 Команды</b>\n\n${div}\n\n`;
    text += `/start — меню\n/ai &lt;текст&gt; — AI\n/model — модели (${MODELS.length})\n`;
    text += `/img &lt;описание&gt; — картинка\n/team — команда\n/super — супер-агенты\n`;
    text += `/openclaw &lt;задача&gt; — автономный агент\n`;
    text += `/github — GitHub skills\n/status — статус\n/about — о боте`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('🏠 Меню', 'back_start')]]) });
});
bot.action('back_start', async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.from.id);
    session.awaitingInput = null;
    const m = getModel(session.modelIdx);
    let text = `<b>🤖 Aisunio v8.0</b>\n\n${div}\n\n`;
    text += `🧠 <b>AI Super Agent</b> с ${MODELS.length} моделями\n`;
    text += `⚡ GitHub Models + LLM7.io + Pollinations\n`;
    text += `🦅 OpenClaw — автономные задачи\n`;
    text += `🎨 Генерация изображений\n`;
    text += `📦 GitHub Skills\n`;
    text += `\n<b>Модель:</b> ${m.emoji} ${m.name}\n`;
    text += `\n<i>Напиши вопрос 👇</i>`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🧠 Спросить AI', 'ai_chat'), telegraf_1.Markup.button.callback('🤖 Выбор модели', 'model_menu')],
            [telegraf_1.Markup.button.callback('👥 Команда', 'team_menu'), telegraf_1.Markup.button.callback('🚀 Супер-агенты', 'super_menu')],
            [telegraf_1.Markup.button.callback('🦅 OpenClaw', 'openclaw_menu'), telegraf_1.Markup.button.callback('📦 GitHub', 'github_menu')],
            [telegraf_1.Markup.button.callback('🎨 Генератор артов', 'art_gen'), telegraf_1.Markup.button.callback('📋 Помощь', 'help_cmd')],
            [telegraf_1.Markup.button.callback('📊 Статус', 'status_cmd')],
        ]) });
});
// ─── Catch-all for unknown callbacks (prevents crash from old buttons) ───
bot.on('callback_query', async (ctx) => {
    // Only fire if no specific handler matched
    const data = ctx.callbackQuery.data;
    if (data && !data.startsWith('m') && !data.startsWith('v_') &&
        !['ai_chat', 'model_menu', 'team_menu', 'super_menu', 'openclaw_menu',
            'openclaw_start', 'github_menu', 'art_gen', 'help_cmd', 'status_cmd',
            'back_start'].includes(data)) {
        await ctx.answerCbQuery('⚠️ Кнопка устарела', { show_alert: false });
        await ctx.replyWithHTML('⚠️ Эта кнопка от старого меню. Напиши /start для нового меню.');
    }
});
// ─── Health check server ───
const healthServer = http_1.default.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            bot: 'Aisunio v8.0',
            models: MODELS.length,
            providers: VENDORS.length,
            openclaw: true,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        }));
    }
    else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>🤖 Aisunio Bot v8.0</h1><p>Bot is running.</p></body></html>');
    }
});
healthServer.listen(PORT, () => {
    console.log(`🌐 Health check server on port ${PORT}`);
});
// ─── Launch ───
async function launch() {
    try {
        // Delete any existing webhook
        await bot.telegram.deleteWebhook().catch(() => { });
        console.log('🤖 Aisunio v8.0 launched');
        console.log(`📊 ${MODELS.length} models from ${VENDORS.length} providers`);
        console.log(`📊 GitHub Models: 18 real | LLM7.io: 3 free | Pollinations: 1 free | Simulated: 7`);
        console.log(`🦅 OpenClaw: ✅ ${OPENCLAW_MODELS.length}-model rotation`);
        console.log(`📦 GitHub: ${GITHUB_TOKEN ? '✅ Connected' : '❌ No token'}`);
        console.log(`🆓 LLM7.io: ✅ (no key needed)`);
        console.log(`🆓 Pollinations: ✅ (no key needed)`);
        console.log('✅ Running 24/7...');
        console.log(`🌐 Health check server on port ${PORT}`);
        bot.launch();
    }
    catch (e) {
        console.error('Failed to launch:', e);
        process.exit(1);
    }
}
launch();
// Graceful shutdown
process.once('SIGINT', () => { bot.stop('SIGINT'); healthServer.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); healthServer.close(); });
