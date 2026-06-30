#!/bin/sh
set -e

echo "⏳ Waiting for database to be ready..."
sleep 2

# Use migrate deploy if migration history exists, otherwise db push
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "📦 Running database migrations..."
  npx prisma migrate deploy
else
  echo "📦 Pushing schema to database..."
  npx prisma db push --accept-data-loss
fi

echo "🌱 Seeding default data..."
npx tsx prisma/seed.ts && echo "✅ Seed complete." || echo "⚠️  Seed skipped (already applied or errored)."

echo "🚀 Starting Hamro Store backend on port $PORT..."
exec node dist/index.js
