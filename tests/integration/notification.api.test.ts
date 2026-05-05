// ============================================================
// notification.api.test.ts — 6 Pruebas de Integración HTTP
// Prueba los endpoints reales del microservicio usando supertest.
//
// Mocks activos:
//   1. NotificationRepository  → mock del repositorio (sin Supabase real)
//   2. email.service.sendEmail → mock del servicio externo de email
//
// La app de prueba (testApp) NO inicia el servidor ni el cron scheduler.
// Los tests son completamente independientes y no tocan la DB real.
// ============================================================

// ⚠️  jest.mock() se eleva automáticamente al inicio (hoisting)
jest.mock('../../src/repositories/notification.repository');
jest.mock('../../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import testApp from '../helpers/testApp';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import {
  mockNotification,
  mockReadNotification,
  TEST_USER_ID,
  TEST_NOTIF_ID,
  TEST_JWT_SECRET,
} from '../helpers/mockData';

// ─── Acceso al prototipo mockeado del repositorio ─────────────────────────────
// Usamos spyOn sobre el prototipo para controlar respuestas en cada test
const repoProto = NotificationRepository.prototype as jest.Mocked<NotificationRepository>;

// ─── Helper: generar JWT de prueba válido ─────────────────────────────────────
function makeToken(userId: string = TEST_USER_ID): string {
  return jwt.sign(
    { sub: userId, id: userId, email: 'test@petwell.com', role: 'DUENO_MASCOTA' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Notification API — Pruebas de Integración', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1 — POST /api/v1/notifications (flujo público sin JWT)
  // Crea notificación SYSTEM con email explícito (permitido sin token)
  // Matchers: toBe (statusCode), toHaveProperty, toBeDefined
  // ══════════════════════════════════════════════════════════════════════════
  it('1. POST /notifications — debe crear notificación pública (SYSTEM + email)', async () => {
    // Arrange — configurar mock del repositorio para este test
    jest.spyOn(repoProto, 'create').mockResolvedValue(mockNotification);
    jest.spyOn(repoProto, 'hasDuplicateVaccineReminder').mockResolvedValue(false);

    const payload = {
      email: 'dueño@petwell.com',
      type: 'SYSTEM',
      title: 'Bienvenido a PetWell',
      message: 'Tu cuenta ha sido creada exitosamente.',
      channel: 'EMAIL',
    };

    // Act
    const res = await request(testApp)
      .post('/api/v1/notifications')
      .send(payload);

    // Assert
    expect(res.status).toBe(201);                                // ← toBe
    expect(res.body).toHaveProperty('success', true);            // ← toHaveProperty
    expect(res.body).toHaveProperty('message', 'Notificación creada exitosamente');
    expect(res.body.data).toBeDefined();                         // ← toBeDefined
    expect(res.body.data).toHaveProperty('id', TEST_NOTIF_ID);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2 — POST /api/v1/notifications — campos requeridos faltantes
  // Valida que el controlador rechaza requests incompletos con 400
  // Matchers: toBe, toHaveProperty
  // ══════════════════════════════════════════════════════════════════════════
  it('2. POST /notifications — debe retornar 400 si faltan campos requeridos', async () => {
    const incompletePayload = {
      email: 'dueño@petwell.com',
      type: 'SYSTEM',
      // ← title y message ausentes intencionalmente
    };

    const res = await request(testApp)
      .post('/api/v1/notifications')
      .send(incompletePayload);

    expect(res.status).toBe(400);                               // ← toBe
    expect(res.body).toHaveProperty('success', false);          // ← toHaveProperty
    expect(res.body.message).toBe('type, title y message son requeridos');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3 — GET /api/v1/notifications — con JWT válido
  // Retorna notificaciones del usuario autenticado
  // Matchers: toBe, toEqual (array)
  // ══════════════════════════════════════════════════════════════════════════
  it('3. GET /notifications — debe retornar notificaciones con JWT válido', async () => {
    // Arrange
    jest.spyOn(repoProto, 'findByUserId').mockResolvedValue([mockNotification]);

    const token = makeToken();

    // Act
    const res = await request(testApp)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(res.status).toBe(200);                               // ← toBe
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);            // ← toBe
    expect(res.body.data).toEqual([mockNotification]);          // ← toEqual (array completo)
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4 — GET /api/v1/notifications — sin JWT → 401
  // Verifica que el middleware de autenticación rechaza requests sin token
  // Matchers: toBe
  // ══════════════════════════════════════════════════════════════════════════
  it('4. GET /notifications — debe retornar 401 sin token de autenticación', async () => {
    const res = await request(testApp)
      .get('/api/v1/notifications');
      // ← Sin header Authorization

    expect(res.status).toBe(401);                               // ← toBe
    expect(res.body).toHaveProperty('message');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5 — PATCH /api/v1/notifications/:id/read — con JWT válido
  // Marca una notificación como leída
  // Matchers: toBe, toHaveProperty, toEqual
  // Usa async/await con resolves implícito (la promesa de supertest resuelve)
  // ══════════════════════════════════════════════════════════════════════════
  it('5. PATCH /notifications/:id/read — debe marcar como leída con JWT válido', async () => {
    // Arrange
    jest.spyOn(repoProto, 'markAsRead').mockResolvedValue(mockReadNotification);

    const token = makeToken();

    // Act
    const res = await request(testApp)
      .patch(`/api/v1/notifications/${TEST_NOTIF_ID}/read`)
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(res.status).toBe(200);                              // ← toBe
    expect(res.body).toHaveProperty('is_read', true);          // ← toHaveProperty
    expect(res.body.id).toEqual(TEST_NOTIF_ID);                // ← toEqual
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 6 — PATCH /api/v1/notifications/:id/read — sin JWT → 401
  // Verifica protección del endpoint de marcado como leída
  // Matchers: toBe
  // ══════════════════════════════════════════════════════════════════════════
  it('6. PATCH /notifications/:id/read — debe retornar 401 sin autenticación', async () => {
    const res = await request(testApp)
      .patch(`/api/v1/notifications/${TEST_NOTIF_ID}/read`);
      // ← Sin header Authorization

    expect(res.status).toBe(401);                              // ← toBe
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 7 — PATCH /api/v1/notifications/:id/status — estado válido SENT
  // Cubre: updateNotificationStatus controller (ruta /:id/status)
  // Matchers: toBe, toHaveProperty, toEqual
  // ══════════════════════════════════════════════════════════════════════════
  it('7. PATCH /notifications/:id/status — debe actualizar estado a SENT', async () => {
    const sentNotification = { ...mockNotification, status: 'SENT', sent_at: new Date().toISOString() };
    jest.spyOn(repoProto, 'findById').mockResolvedValue(mockNotification);
    jest.spyOn(repoProto, 'updateStatus').mockResolvedValue(sentNotification as any);

    const token = makeToken();

    const res = await request(testApp)
      .patch(`/api/v1/notifications/${TEST_NOTIF_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SENT' });

    expect(res.status).toBe(200);                             // ← toBe
    expect(res.body).toHaveProperty('success', true);         // ← toHaveProperty
    expect(res.body.data).toEqual(
      expect.objectContaining({ status: 'SENT' })             // ← toEqual
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 8 — PATCH /api/v1/notifications/:id/status — estado inválido → 400
  // Cubre: validación de status en updateNotificationStatus controller
  // Matchers: toBe, toHaveProperty
  // ══════════════════════════════════════════════════════════════════════════
  it('8. PATCH /notifications/:id/status — debe retornar 400 con status inválido', async () => {
    const token = makeToken();

    const res = await request(testApp)
      .patch(`/api/v1/notifications/${TEST_NOTIF_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INVALIDO' });

    expect(res.status).toBe(400);                             // ← toBe
    expect(res.body).toHaveProperty('success', false);        // ← toHaveProperty
    expect(res.body.message).toBeDefined();                   // ← toBeDefined
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 9 — PATCH /api/v1/notifications/read-all — con JWT válido
  // Cubre: markAllAsRead controller (ruta /read-all)
  // Matchers: toBe, toHaveProperty
  // ══════════════════════════════════════════════════════════════════════════
  it('9. PATCH /notifications/read-all — debe marcar todas como leídas con JWT válido', async () => {
    const readList = [mockReadNotification, { ...mockReadNotification, id: 'id-2' }];
    jest.spyOn(repoProto, 'markAllAsRead').mockResolvedValue(readList as any);

    const token = makeToken();

    const res = await request(testApp)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);                             // ← toBe
    expect(Array.isArray(res.body)).toBe(true);               // ← toBe (verifica que es un array)
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 10 — POST /api/v1/notifications — con JWT de usuario autenticado
  // Cubre: createNotification controller cuando hay Authorization header
  // Matchers: toBe, toBeDefined, toHaveProperty
  // ══════════════════════════════════════════════════════════════════════════
  it('10. POST /notifications — debe crear notificación con JWT autenticado', async () => {
    jest.spyOn(repoProto, 'create').mockResolvedValue(mockNotification);
    jest.spyOn(repoProto, 'hasDuplicateVaccineReminder').mockResolvedValue(false);

    const token = makeToken();

    const res = await request(testApp)
      .post('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'SYSTEM',
        title: 'Notificación con JWT',
        message: 'Creada con usuario autenticado',
        channel: 'EMAIL',
      });

    expect(res.status).toBe(201);                             // ← toBe
    expect(res.body).toHaveProperty('success', true);         // ← toHaveProperty
    expect(res.body.data).toBeDefined();                      // ← toBeDefined
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 11 — POST /api/v1/notifications — sin JWT y sin email → 401
  // Cubre: rama de rechazo en authenticateOrPublic
  // Matchers: toBe, toHaveProperty
  // ══════════════════════════════════════════════════════════════════════════
  it('11. POST /notifications — debe retornar 401 sin JWT y sin email explícito', async () => {
    const res = await request(testApp)
      .post('/api/v1/notifications')
      .send({
        // Sin email y sin Authorization header
        type: 'APPOINTMENT_REMINDER',
        title: 'Sin email',
        message: 'Debe fallar',
      });

    expect(res.status).toBe(401);                             // ← toBe
    expect(res.body).toHaveProperty('success', false);        // ← toHaveProperty
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 12 — POST /api/v1/notifications — sin JWT pero con email válido (flujo AUTH)
  // Cubre: la otra rama de authenticateOrPublic
  // Matchers: toBe, toHaveProperty
  // ══════════════════════════════════════════════════════════════════════════
  it('12. POST /notifications — permite type AUTH con email sin JWT', async () => {
    jest.spyOn(repoProto, 'create').mockResolvedValue(mockNotification);
    
    const res = await request(testApp)
      .post('/api/v1/notifications')
      .send({
        type: 'AUTH',
        email: 'nuevo@petwell.com',
        title: 'Verificación',
        message: 'Código 1234',
        channel: 'EMAIL',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
  });
});
