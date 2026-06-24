#!/bin/bash
set -e

echo "🚀 VirtNum Deploy Script"
echo "========================"

# Check .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found! Copy .env.example → .env and fill in values."
  exit 1
fi

# Pull latest changes (if git repo)
if [ -d .git ]; then
  echo "📦 Pulling latest changes..."
  git pull origin main
fi

echo "🔨 Building Docker images..."
docker compose build --no-cache

echo "🛑 Stopping old containers..."
docker compose down

echo "▶️  Starting services..."
docker compose up -d

echo "⏳ Waiting for database..."
sleep 8

echo "🌱 Running database seed (first deploy)..."
docker compose exec backend npx ts-node prisma/seed.ts || true

echo ""
echo "✅ Deployment complete!"
echo "   Frontend: http://localhost"
echo "   Backend:  http://localhost/api"
echo "   Admin:    admin@virtnum.io / Admin123!"
echo "   Demo:     demo@virtnum.io  / User1234!"
