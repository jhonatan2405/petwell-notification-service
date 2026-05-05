import { Notification, CreateNotificationDTO } from '../../src/models/notification.model';

// ─── IDs de prueba ────────────────────────────────────────────────────────────
export const TEST_USER_ID   = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const TEST_NOTIF_ID  = 'f1e2d3c4-b5a6-7890-abcd-123456789012';
export const TEST_JWT_SECRET = 'test-secret-petwell-jwt-2024';

// ─── Notificación mock base ───────────────────────────────────────────────────
export const mockNotification: Notification = {
  id: TEST_NOTIF_ID,
  user_id: TEST_USER_ID,
  email: 'test@petwell.com',
  type: 'SYSTEM',
  title: 'Prueba de notificación',
  message: 'Este es un mensaje de prueba para los tests',
  channel: 'EMAIL',
  status: 'PENDING',
  scheduled_at: null,
  sent_at: null,
  is_read: false,
  metadata: null,
  created_at: '2024-01-15T10:00:00.000Z',
  updated_at: '2024-01-15T10:00:00.000Z',
};

// ─── DTO de creación válido ───────────────────────────────────────────────────
export const mockCreateDTO: CreateNotificationDTO = {
  user_id: TEST_USER_ID,
  type: 'SYSTEM',
  title: 'Prueba de notificación',
  message: 'Este es un mensaje de prueba para los tests',
  channel: 'EMAIL',
};

// ─── Notificación marcada como leída ─────────────────────────────────────────
export const mockReadNotification: Notification = {
  ...mockNotification,
  is_read: true,
  updated_at: '2024-01-15T12:00:00.000Z',
};

// ─── Notificación de vacuna (para test de duplicados) ────────────────────────
export const mockVaccineNotification: Notification = {
  ...mockNotification,
  id: 'vacc-notif-id-0001',
  type: 'VACCINE_REMINDER',
  title: 'Recordatorio de vacuna',
  message: 'Tu mascota necesita su vacuna anual',
  scheduled_at: '2024-02-01T09:00:00.000Z',
  metadata: { pet_id: 'pet-uuid-001', vaccination_id: 'vacc-uuid-001' },
};
