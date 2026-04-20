import { supabase } from '../config/supabase';
import {
  Notification,
  CreateNotificationDTO,
  UpdateNotificationStatusDTO,
} from '../models/notification.model';

const TABLE = 'notifications';

export class NotificationRepository {
  // Crear una notificación nueva
  async create(dto: CreateNotificationDTO): Promise<Notification> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: dto.user_id || null,
        email: dto.email || null,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        channel: dto.channel ?? 'EMAIL',
        status: 'PENDING',
        scheduled_at: dto.scheduled_at ?? null,
        metadata: dto.metadata ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Error creando notificación: ${error.message}`);
    return data as Notification;
  }

  // Verificar si existe una notificación duplicada de vacunas
  async hasDuplicateVaccineReminder(petId: string, vaccineId: string, scheduledAt: string): Promise<boolean> {
    const { count, error } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('type', 'VACCINE_REMINDER')
      .eq('scheduled_at', scheduledAt)
      .eq('metadata->>pet_id', petId)
      .eq('metadata->>vaccination_id', vaccineId);

    if (error) {
      console.error('Error verificando duplicados:', error.message);
      return false; // Ante duda, falso, para no bloquear falsamente
    }

    return (count ?? 0) > 0;
  }

  // Obtener notificaciones de un usuario con paginación
  async findByUserId(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<Notification[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Error obteniendo notificaciones: ${error.message}`);
    return (data ?? []) as Notification[];
  }

  // Buscar notificación por ID
  async findById(id: string): Promise<Notification | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as Notification;
  }

  // Actualizar estado de una notificación
  async updateStatus(
    id: string,
    dto: UpdateNotificationStatusDTO
  ): Promise<Notification> {
    const updateData: Partial<Notification> = { status: dto.status };
    if (dto.sent_at) updateData.sent_at = dto.sent_at;

    const { data, error } = await supabase
      .from(TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error actualizando estado: ${error.message}`);
    return data as Notification;
  }

  // Obtener notificaciones pendientes cuyo scheduled_at ya pasó (para el cron)
  async findPendingDue(): Promise<Notification[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('status', 'PENDING')
      .lte('scheduled_at', now)
      .not('scheduled_at', 'is', null);

    if (error) throw new Error(`Error buscando pendientes: ${error.message}`);
    return (data ?? []) as Notification[];
  }

  // Marcar una notificación como leída
  async markAsRead(id: string, userId: string): Promise<Notification> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Error marcando como leída: ${error.message}`);
    return data as Notification;
  }

  // Marcar todas como leídas (BONUS)
  async markAllAsRead(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) throw new Error(`Error marcando todas como leídas: ${error.message}`);
    return (data ?? []) as Notification[];
  }
}
