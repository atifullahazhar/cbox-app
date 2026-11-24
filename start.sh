#!/usr/bin/env bash
set -e

echo "[Chatterbox] Running PostgreSQL Prisma migrations..."
npm --workspace=backend run db:migrate

echo "[Chatterbox] Starting Python Argon2id & OTP Auth Engine on 127.0.0.1:8001..."
/opt/venv/bin/uvicorn app:app --app-dir /app/python-auth --host 127.0.0.1 --port 8001 --workers 1 &
PY_PID=$!

# Wait up to 15s for Python auth engine health check
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8001/internal/health >/dev/null 2>&1; then
    echo "[Chatterbox] Python Auth Engine ready."
    break
  fi
  sleep 0.5
done

echo "[Chatterbox] Starting Node.js Express + Socket.IO + PWA server..."
exec npm --workspace=backend run start
