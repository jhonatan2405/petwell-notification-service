// ============================================================
// testApp.ts — Express app aislada para pruebas de integración
// NO inicia el servidor ni el scheduler (cron).
// Se usa con supertest: request(testApp).get(...)
// ============================================================
import express from 'express';
import cors from 'cors';

import notificationRoutes from '../../src/routes/notification.routes';
import { errorHandler } from '../../src/middlewares/error.middleware';

const testApp = express();

testApp.use(express.json());
testApp.use(cors());

// Health check (para verificar que la app carga)
testApp.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service-test' });
});

// Rutas del microservicio
testApp.use('/api/v1/notifications', notificationRoutes);

// Error handler global
testApp.use(errorHandler);

export default testApp;
