# Chatterbox CB1 — Unified Node.js 20 + Python 3.11 Docker Image for Render
FROM node:20-bookworm-slim

# Install Python 3, venv, OpenSSL (for Prisma), and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Python Auth Microservice dependencies in an isolated virtualenv
COPY python-auth/requirements.txt ./python-auth/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r ./python-auth/requirements.txt

# 2. Install Node dependencies (root + backend + frontend)
COPY package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm install --include=dev \
    && npm --prefix /app/backend install --include=dev \
    && npm --prefix /app/frontend install --include=dev

# 3. Copy full source code
COPY . .

ENV PATH="/app/node_modules/.bin:/app/backend/node_modules/.bin:/app/frontend/node_modules/.bin:/opt/venv/bin:$PATH"

# 4. Generate Prisma client, compile TypeScript backend, and build Vite React PWA
RUN npm --prefix /app/backend run db:generate \
    && npm --prefix /app/backend run build \
    && npm --prefix /app/frontend run build \
    && chmod +x /app/start.sh

ENV NODE_ENV=production
ENV SERVE_FRONTEND=true
ENV PYTHON_AUTH_URL=http://127.0.0.1:8001

EXPOSE 4000
CMD ["/app/start.sh"]
