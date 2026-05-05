// ============================================================
// notification.service.test.ts — 6 Pruebas Unitarias
// Prueba la lógica de negocio de NotificationService
// en AISLAMIENTO total: sin Supabase, sin email real.
//
// Mocks activos:
//   1. NotificationRepository  → mock del repositorio (Supabase)
//   2. email.service.sendEmail → mock del servicio externo de email
// ============================================================

// ⚠️  jest.mock() se eleva automáticamente al inicio del archivo (hoisting)
jest.mock('../../src/repositories/notification.repository');
jest.mock('../../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import { NotificationService } from '../../src/services/notification.service';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import {
  mockNotification,
  mockCreateDTO,
  mockReadNotification,
  mockVaccineNotification,
  TEST_USER_ID,
  TEST_NOTIF_ID,
} from '../helpers/mockData';

// ─── Acceso al mock del repositorio ──────────────────────────────────────────
// notification.service.ts crea `const repo = new NotificationRepository()`
// al nivel de módulo. Al mockear la clase, instances[0] es ese repo singleton.
const MockedRepo = NotificationRepository as jest.MockedClass<typeof NotificationRepository>;

// ─────────────────────────────────────────────────────────────────────────────
describe('NotificationService — Pruebas Unitarias', () => {

  let repoInstance: jest.Mocked<NotificationRepository>;

  beforeAll(() => {
    // Capturamos la instancia del repo creada al cargar el módulo del servicio
    repoInstance = MockedRepo.mock.instances[0] as jest.Mocked<NotificationRepository>;
  });

  beforeEach(() => {
    // Limpiar historial de llamadas entre tests (pero mantener las implementaciones)
    jest.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Creación exitosa de notificación
  // Cubre: createNotification con DTO válido
  // Matchers: toBeDefined, toHaveProperty, toEqual
  // ══════════════════════════════════════════════════════════════════════════
  it('1. debe crear una notificación correctamente con datos válidos', async () => {
    // Arrange — configuramos el mock del repositorio
    repoInstance.create.mockResolvedValue(mockNotification);

    // Act
    const result = await expect(
      new NotificationService().createNotification(mockCreateDTO)
    ).resolves.toBeDefined(); // ← matcher: resolves + toBeDefined

    // Assert adicional — verificar estructura del objeto retornado
    // (accedemos al resultado directamente para matchers adicionales)
    const notif = await new NotificationService().createNotification(mockCreateDTO);

    expect(notif).toHaveProperty('id');                     // ← toHaveProperty
    expect(notif).toHaveProperty('status', 'PENDING');      // ← toHaveProperty con valor
    expect(notif.user_id).toBe(TEST_USER_ID);               // ← toBe
    expect(notif.type).toEqual('SYSTEM');                   // ← toEqual
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Validación: user_id y email ausentes
  // Cubre: validación de campos requeridos en createNotification
  // Matchers: rejects (promesas que rechazan)
  // ══════════════════════════════════════════════════════════════════════════
  it('2. debe lanzar error cuando falta user_id Y email', async () => {
    const invalidDTO = {
      type: 'SYSTEM' as const,
      title: 'Sin destinatario',
      message: 'Este DTO no tiene ni user_id ni email',
    };

    // Act & Assert — promesa debe rechazarse con mensaje específico
    await expect(
      new NotificationService().createNotification(invalidDTO)
    ).rejects.toThrow('Al menos user_id o email deben ser proporcionados'); // ← rejects
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3 — Prevención de notificaciones de vacuna duplicadas
  // Cubre: lógica de deduplicación de VACCINE_REMINDER
  // Matchers: toBe (id === 'skipped-duplicate')
  // ══════════════════════════════════════════════════════════════════════════
  it('3. debe retornar skipped-duplicate si ya existe la notificación de vacuna', async () => {
    // Arrange — el repo reporta que ya existe ese recordatorio
    repoInstance.hasDuplicateVaccineReminder.mockResolvedValue(true);

    const vaccineDTO = {
      user_id: TEST_USER_ID,
      type: 'VACCINE_REMINDER' as const,
      title: mockVaccineNotification.title,
      message: mockVaccineNotification.message,
      scheduled_at: '2024-02-01T09:00:00.000Z',
      metadata: { pet_id: 'pet-uuid-001', vaccination_id: 'vacc-uuid-001' },
    };

    // Act
    const result = await new NotificationService().createNotification(vaccineDTO);

    // Assert
    expect(result.id).toBe('skipped-duplicate');            // ← toBe
    expect(repoInstance.create).not.toHaveBeenCalled();     // no inserta en DB
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4 — Validación de usuario en getNotificationsByUser
  // Cubre: guard clause cuando userId está vacío
  // Matchers: rejects
  // ══════════════════════════════════════════════════════════════════════════
  it('4. debe lanzar error al obtener notificaciones sin userId', async () => {
    await expect(
      new NotificationService().getNotificationsByUser('')
    ).rejects.toThrow('user_id undefined en request');      // ← rejects
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5 — Marcado como leída
  // Cubre: markNotificationAsRead con id y userId válidos
  // Matchers: toEqual (objeto completo), toHaveProperty
  // ══════════════════════════════════════════════════════════════════════════
  it('5. debe marcar una notificación como leída correctamente', async () => {
    // Arrange
    repoInstance.markAsRead.mockResolvedValue(mockReadNotification);

    // Act
    const result = await new NotificationService().markNotificationAsRead(
      TEST_NOTIF_ID,
      TEST_USER_ID
    );

    // Assert
    expect(result).toHaveProperty('is_read', true);        // ← toHaveProperty
    expect(result.id).toEqual(TEST_NOTIF_ID);              // ← toEqual
    expect(repoInstance.markAsRead).toHaveBeenCalledWith(TEST_NOTIF_ID, TEST_USER_ID);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 6 — Manejo de error: updateNotificationStatus sin notificación
  // Cubre: verificación de existencia antes de actualizar estado
  // Matchers: rejects + toThrow con mensaje específico
  // ══════════════════════════════════════════════════════════════════════════
  it('6. debe lanzar error al actualizar estado de notificación inexistente', async () => {
    // Arrange — el repo retorna null: notificación no encontrada
    repoInstance.findById.mockResolvedValue(null);

    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    // Act & Assert
    await expect(
      new NotificationService().updateNotificationStatus(nonExistentId, { status: 'SENT' })
    ).rejects.toThrow(`Notificación ${nonExistentId} no encontrada`); // ← rejects
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 7 — markAllNotificationsAsRead exitoso
  // Cubre: markAllNotificationsAsRead con userId válido
  // Matchers: toEqual (array), toBeDefined
  // ══════════════════════════════════════════════════════════════════════════
  it('7. debe marcar todas las notificaciones como leídas para un usuario', async () => {
    const readList = [
      { ...mockReadNotification, id: 'id-1' },
      { ...mockReadNotification, id: 'id-2' },
    ] as any[];
    repoInstance.markAllAsRead.mockResolvedValue(readList);

    const result = await new NotificationService().markAllNotificationsAsRead(TEST_USER_ID);

    expect(result).toBeDefined();                            // ← toBeDefined
    expect(Array.isArray(result)).toBe(true);               // ← toBe
    expect(result).toEqual(readList);                       // ← toEqual
    expect(repoInstance.markAllAsRead).toHaveBeenCalledWith(TEST_USER_ID);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 8 — markAllNotificationsAsRead sin userId → error
  // Cubre: guard clause de markAllNotificationsAsRead
  // Matchers: rejects
  // ══════════════════════════════════════════════════════════════════════════
  it('8. debe lanzar error en markAllNotificationsAsRead sin userId', async () => {
    await expect(
      new NotificationService().markAllNotificationsAsRead('')
    ).rejects.toThrow('Datos inválidos para marcar notificaciones'); // ← rejects
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 9 — processPendingNotifications sin pendientes
  // Cubre: early return cuando no hay notificaciones pendientes
  // Matchers: toBeDefined (función retorna undefined sin error)
  // ══════════════════════════════════════════════════════════════════════════
  it('9. processPendingNotifications debe retornar sin error cuando no hay pendientes', async () => {
    repoInstance.findPendingDue.mockResolvedValue([]);

    const result = await new NotificationService().processPendingNotifications();

    expect(result).toBeUndefined();                        // void fn returns undefined
    expect(repoInstance.findPendingDue).toHaveBeenCalled();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 10 — onAppointmentCreated
  // Cubre: creación de recordatorio de cita programado 24h antes
  // Matchers: toBeDefined, toHaveBeenCalledWith (verificación de llamada)
  // ══════════════════════════════════════════════════════════════════════════
  it('10. onAppointmentCreated debe crear un APPOINTMENT_REMINDER', async () => {
    repoInstance.create.mockResolvedValue({
      ...mockNotification,
      type: 'APPOINTMENT_REMINDER',
    } as any);
    repoInstance.hasDuplicateVaccineReminder.mockResolvedValue(false);

    const payload = {
      userId: TEST_USER_ID,
      appointmentDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      petName: 'Luna',
      vetName: 'Dr. García',
      email: 'dueno@petwell.com',
    };

    // No debe lanzar error
    await expect(
      new NotificationService().onAppointmentCreated(payload)
    ).resolves.toBeUndefined();                            // ← resolves (promesa exitosa)

    expect(repoInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'APPOINTMENT_REMINDER' })
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 11 — onTelemedStarted
  // Cubre: creación de notificación TELEMED inmediata
  // Matchers: resolves, toHaveBeenCalledWith
  // ══════════════════════════════════════════════════════════════════════════
  it('11. onTelemedStarted debe crear una notificación TELEMED', async () => {
    repoInstance.create.mockResolvedValue({
      ...mockNotification,
      type: 'TELEMED',
    } as any);
    repoInstance.hasDuplicateVaccineReminder.mockResolvedValue(false);

    const payload = {
      userId: TEST_USER_ID,
      sessionUrl: 'https://telemed.petwell.com/room/abc123',
      email: 'dueno@petwell.com',
    };

    await expect(
      new NotificationService().onTelemedStarted(payload)
    ).resolves.toBeUndefined();                            // ← resolves

    expect(repoInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TELEMED' })
    );
  });
  // TEST 12 — dispatchNotification con error
  // Cubre: catch block en dispatchNotification (líneas ~159-163)
  // Matchers: resolves (ya que el error se captura internamente), toHaveBeenCalledWith
  // ══════════════════════════════════════════════════════════════════════════
  it('12. processPendingNotifications debe capturar error y marcar como FAILED', async () => {
    // Arrange: Devolver una notificación pendiente válida para que se despache
    repoInstance.findPendingDue.mockResolvedValue([mockNotification]);

    // Hacemos que el mock de sendEmail lance un error intencionalmente
    const { sendEmail } = require('../../src/services/email.service');
    sendEmail.mockRejectedValueOnce(new Error('SMTP Error simulate'));

    // Act
    await expect(
      new NotificationService().processPendingNotifications()
    ).resolves.toBeUndefined(); // El catch de dispatch atrapa el error y actualiza estado

    // Assert: Debe haberse intentado enviar y luego marcado como FAILED
    expect(sendEmail).toHaveBeenCalled();
    expect(repoInstance.updateStatus).toHaveBeenCalledWith(
      TEST_NOTIF_ID,
      expect.objectContaining({ status: 'FAILED' })
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 13 — onAppointmentCancelled
  // Cubre: creación de notificación SYSTEM por cancelación de cita
  // Matchers: resolves, toHaveBeenCalledWith
  // ══════════════════════════════════════════════════════════════════════════
  it('13. onAppointmentCancelled debe crear una notificación SYSTEM inmediata', async () => {
    repoInstance.create.mockResolvedValue(mockNotification);
    
    const payload = {
      userId: TEST_USER_ID,
      appointmentDate: new Date().toISOString(),
      email: 'dueno@petwell.com',
    };

    await expect(
      new NotificationService().onAppointmentCancelled(payload)
    ).resolves.toBeUndefined();

    expect(repoInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SYSTEM' })
    );
  });
});
