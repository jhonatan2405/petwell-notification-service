import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import notificationRoutes from './routes/notification.routes';
import { errorHandler } from './middlewares/error.middleware';
import { startScheduler } from './services/scheduler.service';

const app = express();
const PORT = process.env.PORT ?? 3007;

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'notification-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Rutas principales ────────────────────────────────────────────────────────
app.use('/api/v1/notifications', notificationRoutes);

// ─── 404 catch-all ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// ─── Error handler global ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Inicio del servidor ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🐾 Notification Service corriendo en http://localhost:${PORT}`);
  console.log(`📋 Health: http://localhost:${PORT}/health`);

  // Iniciar el cron scheduler
  startScheduler();
});

export default app;
