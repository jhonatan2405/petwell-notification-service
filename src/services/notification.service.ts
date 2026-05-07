import {
  Notification,
  CreateNotificationDTO,
  UpdateNotificationStatusDTO,
} from '../models/notification.model';
import { NotificationRepository } from '../repositories/notification.repository';
import { sendEmail } from './email.service';

const repo = new NotificationRepository();

export class NotificationService {
  // ─── CRUD ────────────────────────────────────────────────────────────────

  async createNotification(dto: CreateNotificationDTO): Promise<Notification> {
    if (!dto.user_id && !dto.email) {
      throw new Error('Al menos user_id o email deben ser proporcionados');
    }

    // ── Prevenir Duplicados de Vacunas ──────────────────────────────────────
    if (dto.type === 'VACCINE_REMINDER' && dto.scheduled_at && dto.metadata) {
      const petId = (dto.metadata as any)?.pet_id;
      const vaccineId = (dto.metadata as any)?.vaccination_id;
      if (petId && vaccineId) {
        const isDuplicate = await repo.hasDuplicateVaccineReminder(petId, vaccineId, dto.scheduled_at);
        if (isDuplicate) {
          console.log(`⚠️ Prevented duplicate vaccine reminder for pet ${petId} at ${dto.scheduled_at}`);
          // Retornamos mock vacío para que el cliente no estalle, no encolamos de nuevo.
          return {
            id: 'skipped-duplicate',
            user_id: dto.user_id || '',
            type: dto.type,
            title: dto.title,
            message: dto.message,
            channel: dto.channel || 'EMAIL',
            status: 'PENDING',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            scheduled_at: dto.scheduled_at ?? null,
            sent_at: null,
            metadata: dto.metadata ?? null,
            is_read: false
          };
        }
      }
    }

    const notification = await repo.create(dto);

    console.log('📦 Notificación recibida:', notification);

    // ── Dispatch inmediato ──────────────────────────────────────────────────
    // Se ejecuta si: (hay email directo O hay user_id) Y (no está programado O ya llegó la hora)
    const hasRecipient = !!(notification.email || notification.user_id);
    const isDue = !notification.scheduled_at || new Date(notification.scheduled_at) <= new Date();
    if (hasRecipient && isDue) {
      console.log("⚡ Dispatch inmediato de notificación");
      this.dispatchNotification(notification).catch(err =>
        console.error("❌ Error dispatch inmediato:", err)
      );
    }

    return notification;
  }

  async getNotificationsByUser(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<Notification[]> {
    if (!userId) {
      throw new Error("user_id undefined en request");
    }
    return repo.findByUserId(userId, limit, offset);
  }

  async updateNotificationStatus(
    id: string,
    dto: UpdateNotificationStatusDTO
  ): Promise<Notification> {
    const notification = await repo.findById(id);
    if (!notification) {
      throw new Error(`Notificación ${id} no encontrada`);
    }
    return repo.updateStatus(id, dto);
  }

  async markNotificationAsRead(id: string, userId: string): Promise<Notification> {
    if (!id || !userId) {
      throw new Error("Datos inválidos para marcar notificación");
    }
    return repo.markAsRead(id, userId);
  }

  async markAllNotificationsAsRead(userId: string): Promise<Notification[]> {
    if (!userId) {
      throw new Error("Datos inválidos para marcar notificaciones");
    }
    return repo.markAllAsRead(userId);
  }

  // ─── SCHEDULER ───────────────────────────────────────────────────────────

  /**
   * Procesa todas las notificaciones PENDING con scheduled_at <= now()
   * Este método es llamado por el scheduler.service.ts cada minuto.
   */
  async processPendingNotifications(): Promise<void> {
    const pending = await repo.findPendingDue();

    if (pending.length === 0) return;

    console.log(`[Scheduler] Procesando ${pending.length} notificaciones pendientes...`);

    for (const notification of pending) {
      await this.dispatchNotification(notification);
    }
  }

  // ─── DISPATCH ─────────────────────────────────────────────────────────────

  private async dispatchNotification(notification: Notification): Promise<void> {
    try {
      console.log('📦 Notificación despachando:', JSON.stringify(notification, null, 2));

      // ── Determinar email destinatario ──────────────────────────────────────
      // Prioridad: notification.email → metadata.email → lookup al User Service
      let recipientEmail: string | undefined =
        notification.email ||
        (notification.metadata?.email as string | undefined);

      if (!recipientEmail && notification.user_id) {
        try {
          const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
          const res = await fetch(`${USER_SERVICE_URL}/api/v1/users/${notification.user_id}`);
          if (res.ok) {
            const data = await res.json() as { success: boolean; data?: { email?: string } };
            if (data.success && data.data?.email) {
              recipientEmail = data.data.email;
            }
          }
        } catch {
          console.error(`[Dispatch] No se pudo obtener email de User Service para ${notification.user_id}`);
        }
      }

      // ── Enviar email si hay destinatario ───────────────────────────────────
      if (recipientEmail) {
        console.log('📧 Enviando correo a:', recipientEmail);
        await sendEmail(recipientEmail, notification.title, notification.message, notification);
      } else if (notification.channel === 'PUSH') {
        console.log(`[PUSH] Pendiente de implementar para user ${notification.user_id}`);
      } else if (notification.channel === 'SMS') {
        console.log(`[SMS] Pendiente de implementar para user ${notification.user_id}`);
      } else {
        console.warn(`[Dispatch] ⚠️ Notificación ${notification.id} sin destinatario resolvible — omitida`);
      }

      // Marcar como SENT
      await repo.updateStatus(notification.id, {
        status: 'SENT',
        sent_at: new Date().toISOString(),
      });

      console.log(`[Scheduler] ✅ Notificación ${notification.id} enviada (${notification.type})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] ❌ Error enviando notificación ${notification.id}: ${errorMsg}`);

      // Marcar como FAILED sin bloquear el proceso
      await repo.updateStatus(notification.id, { status: 'FAILED' });
    }
  }

  // ─── EVENTOS DE OTROS SERVICIOS (simulados) ───────────────────────────────

  /**
   * Se llama cuando se crea una cita.
   * Crea una notificación programada 24 horas antes.
   */
  async onAppointmentCreated(payload: {
    userId: string;
    appointmentDate: string;
    petName?: string;
    vetName?: string;
    email?: string;
  }): Promise<void> {
    console.log('[Event] onAppointmentCreated received', payload);

    const appointmentDate = new Date(payload.appointmentDate);
    const scheduledAt = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);

    const formattedDate = appointmentDate.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    await this.createNotification({
      user_id: payload.userId,
      type: 'APPOINTMENT_REMINDER',
      title: '🐾 Recordatorio de cita veterinaria',
      message: `Hola! Te recordamos que tienes una cita veterinaria${
        payload.petName ? ` para ${payload.petName}` : ''
      }${
        payload.vetName ? ` con ${payload.vetName}` : ''
      } el ${formattedDate}.\n\nNo olvides llevar el historial médico de tu mascota.`,
      channel: 'EMAIL',
      scheduled_at: scheduledAt.toISOString(),
      metadata: { email: payload.email, appointmentDate: payload.appointmentDate },
    });
  }

  /**
   * Se llama cuando se cancela una cita.
   * Crea una notificación inmediata de tipo SYSTEM.
   */
  async onAppointmentCancelled(payload: {
    userId: string;
    appointmentDate?: string;
    email?: string;
  }): Promise<void> {
    console.log('[Event] onAppointmentCancelled received', payload);

    await this.createNotification({
      user_id: payload.userId,
      type: 'SYSTEM',
      title: '❌ Cita cancelada',
      message: `Tu cita veterinaria ha sido cancelada.${
        payload.appointmentDate
          ? ` (originalmente programada para ${new Date(payload.appointmentDate).toLocaleString('es-MX')})`
          : ''
      }\n\nPuedes agendar una nueva cita desde la app PetWell.`,
      channel: 'EMAIL',
      scheduled_at: new Date().toISOString(), // inmediata
      metadata: { email: payload.email },
    });
  }

  /**
   * Se llama cuando se inicia una sesión de telemedicina.
   */
  async onTelemedStarted(payload: {
    userId: string;
    sessionUrl?: string;
    email?: string;
  }): Promise<void> {
    console.log('[Event] onTelemedStarted received', payload);

    await this.createNotification({
      user_id: payload.userId,
      type: 'TELEMED',
      title: '🎥 Tu teleconsulta ha iniciado',
      message: `Tu consulta veterinaria por videollamada ha comenzado.${
        payload.sessionUrl ? `\n\nÚnete aquí: ${payload.sessionUrl}` : ''
      }\n\nTu veterinario está esperando.`,
      channel: 'EMAIL',
      scheduled_at: new Date().toISOString(), // inmediata
      metadata: { email: payload.email, sessionUrl: payload.sessionUrl },
    });
  }
}
