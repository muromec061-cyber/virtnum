# 🤖 Aisunio Bot v7.0 — 25 AI Models

AI Super Agent Telegram bot with 25 models from 9 providers.

## 🚀 Quick Deploy (FREE, no credit card)

### Option 1: SnapDeploy (recommended — free Docker hosting)
1. Go to https://snapdeploy.dev/register
2. Sign up with GitHub or email (no credit card needed)
3. Click "New Container" → "GitHub"
4. Select `muromec061-cyber/virtnum` repo
5. Set:
   - **Root Directory**: `bot`
   - **Port**: `3000`
   - **Environment Variables**:
     - `TELEGRAM_BOT_TOKEN` = your bot token
     - `GITHUB_ACCESS_TOKEN` = your GitHub token (for AI models)
6. Click "Deploy"
7. Your bot is live 24/7! URL: `https://aisunio-bot.containers.snapdeploy.dev`

### Option 2: GitHub Container Registry + any Docker host
```bash
# Pull the image
docker pull ghcr.io/muromec061-cyber/virtnum/aisunio-bot:latest

# Run it
docker run -d \
  -p 3000:3000 \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e GITHUB_ACCESS_TOKEN=your_github_token \
  --name aisunio-bot \
  ghcr.io/muromec061-cyber/virtnum/aisunio-bot:latest
```

### Option 3: Hugging Face Spaces (free, 24/7)
1. Create account at https://huggingface.co
2. Create new Space → SDK: Docker
3. Clone the Space repo
4. Copy files from `bot/` directory
5. Create `README.md` with:
```yaml
---
title: Aisunio Bot
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 3000
---
```
6. Set Secrets in Space Settings:
   - `TELEGRAM_BOT_TOKEN`
   - `GITHUB_ACCESS_TOKEN`
7. Push and enjoy 24/7 hosting!

## 🧠 AI Models (25 total)

### Real Models (18) — GitHub Models API
| Provider | Model | Status |
|----------|-------|--------|
| OpenAI | GPT-4o | ✅ |
| OpenAI | GPT-4o Mini | ✅ |
| OpenAI | GPT-4.1 | ✅ |
| OpenAI | GPT-4.1 Mini | ✅ |
| OpenAI | GPT-4.1 Nano | ✅ |
| DeepSeek | V3 | ✅ |
| DeepSeek | R1 | ✅ |
| Meta | Llama 3.3 70B | ✅ |
| Meta | Llama 4 Maverick | ✅ |
| Meta | Llama 4 Scout | ✅ |
| Mistral | Medium | ✅ |
| Mistral | Small | ✅ |
| Mistral | Codestral | ✅ |
| Mistral | Ministral 3B | ✅ |
| Microsoft | Phi-4 Mini | ✅ |
| Microsoft | Phi-4 Mini Reasoning | ✅ |
| Microsoft | Phi-4 Reasoning | ✅ |
| Cohere | Command-A | ✅ |

### Simulated Models (7) — via GPT-4o with personality prompts
| Provider | Model | Base |
|----------|-------|------|
| Anthropic | Claude Sonnet 4 | GPT-4o |
| Anthropic | Claude Opus 4.6 | GPT-4o |
| Anthropic | Claude Haiku 4.5 | GPT-4o Mini |
| xAI | Grok-3 | GPT-4o |
| xAI | Grok-2 | GPT-4o Mini |
| Google | Gemini Pro | GPT-4o |
| Google | Gemini Flash | GPT-4o Mini |

## 📋 Commands
- `/start` — Main menu
- `/ai <text>` — Ask AI
- `/model` — Select model (25 options)
- `/img <description>` — Generate image (Flux)
- `/team` — Team agents
- `/super` — Super agents
- `/openclaw <task>` — Autonomous agent (8-model rotation)
- `/github` — GitHub skills
- `/status` — Bot status
- `/about` — About bot

## 🔧 Tech Stack
- Node.js 20 + TypeScript
- Telegraf (Telegram Bot API)
- GitHub Models API (AI inference)
- Pollinations AI (free fallback + image generation)
- HTTP health check server (port 3000)
