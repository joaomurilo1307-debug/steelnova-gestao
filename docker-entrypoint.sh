#!/bin/sh
set -e

echo "Aplicando schema no banco..."
npx prisma db push --skip-generate --accept-data-loss

if [ "$RUN_SEED" = "true" ]; then
  echo "Rodando seed..."
  npx tsx prisma/seed.ts || true
fi

if [ -n "$SYNC_EMPRESA" ]; then
  echo "Sincronizando estado da empresa ($SYNC_EMPRESA)..."
  npx tsx prisma/sync-empresa.ts || true
fi

echo "Iniciando aplicacao..."
exec npx next start -p 3000
