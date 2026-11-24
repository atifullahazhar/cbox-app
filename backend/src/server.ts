import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { generalApiLimiter } from './middleware/rateLimits.js';
import { attachSocketServer } from './realtime/socket.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { friendsRouter } from './routes/friends.js';
import { chatRouter } from './routes/chat.js';
import { postsRouter } from './routes/posts.js';
import { mediaRouter } from './routes/media.js';
import { developerRouter } from './routes/developer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.appOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/api', generalApiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cbox-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/posts', postsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/developer', developerRouter);

// Single-origin production hosting: serve built React/Vite PWA from frontend/dist
if (env.serveFrontend) {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.get('/sw.js', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(frontendDist, 'sw.js'));
    });

    app.get('/manifest.webmanifest', (_req, res) => {
      res.setHeader('Content-Type', 'application/manifest+json');
      res.sendFile(path.join(frontendDist, 'manifest.webmanifest'));
    });

    app.use(
      express.static(frontendDist, {
        index: false,
        maxAge: '7d',
      })
    );

    // SPA fallback for client routes (never swallow /api or /socket.io)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    console.warn('[Cbox Backend] frontend/dist not found; serving API only.');
  }
}

// Global error handler — never expose stack traces or secrets in responses
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: `Uploaded file is too large. Maximum allowed size is ${Math.round(env.maxUploadBytes / (1024 * 1024))} MB.`,
    });
    return;
  }
  console.error('[Cbox Server Error]', err instanceof Error ? err.message : 'Unknown error');
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

const httpServer = http.createServer(app);
attachSocketServer(httpServer);

httpServer.listen(env.port, () => {
  console.log(`[Cbox] Listening on port ${env.port} (${env.nodeEnv})`);
  console.log(`[Cbox] Origin: ${env.appOrigin} | Serve Frontend: ${env.serveFrontend} | Storage: ${env.storageDriver}`);
});
