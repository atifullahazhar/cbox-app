#!/usr/bin/env bash
set -e

export PATH="/app/node_modules/.bin:/app/backend/node_modules/.bin:/opt/venv/bin:$PATH"

echo "[Chatterbox CB2.0] Running PostgreSQL Prisma migrations..."
npm --prefix /app/backend run db:migrate

echo "[Chatterbox CB2.0] Starting Python Security Engine on 127.0.0.1:8001..."
/opt/venv/bin/uvicorn app:app --app-dir /app/python-auth --host 127.0.0.1 --port 8001 --workers 1 &
PY_PID=$!

# Wait up to 15s for Python auth engine health check
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8001/internal/health >/dev/null 2>&1; then
    echo "[Chatterbox CB2.0] Python Security Engine ready."
    break
  fi
  sleep 0.5
done

echo "[Chatterbox CB2.0] Starting Node.js Express + Socket.IO + PWA server..."
exec npm --prefix /app/backend run start
