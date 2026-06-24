#!/bin/bash
set -e

echo "🛠  Starting VirtNum in development mode"

# Start postgres only
docker compose up -d postgres

echo "⏳ Waiting for postgres..."
sleep 5

# Backend
echo "🔌 Starting backend..."
cd backend
cp ../.env.example .env 2>/dev/null || true
npm install
npx prisma generate
npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
npx ts-node prisma/seed.ts 2>/dev/null || true
npm run dev &

# Frontend
echo "🎨 Starting frontend..."
cd ../frontend
cp ../.env.example .env.local 2>/dev/null || true
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws" >> .env.local
npm install
npm run dev &

echo ""
echo "✅ Dev servers running:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
wait
