---
title: Aisunio Bot
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Aisunio Bot v7.0

AI Super Agent Telegram Bot with 25+ AI models via GitHub Models API + Pollinations.

## Features
- 18 real AI models (GPT-4o, DeepSeek, Llama, Mistral, Phi-4, Codestral, Command-A)
- 7 simulated models (Claude, Grok, Gemini via GPT-4o)
- OpenClaw autonomous agent
- GitHub Skills integration
- Image generation (Flux, Sana, Turbo)
- Health check endpoint

## Environment Variables
Set in Space Settings → Secrets:
- `TELEGRAM_BOT_TOKEN` — Telegram bot token from @BotFather
- `GITHUB_ACCESS_TOKEN` — GitHub token for AI Models API
