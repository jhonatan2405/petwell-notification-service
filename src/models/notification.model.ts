// ============================================================
// Notification Model — tipos compartidos
// ============================================================

export type NotificationType =
  | 'APPOINTMENT_REMINDER'
  | 'VACCINE_REMINDER'
  | 'BIRTHDAY_REMINDER'
  | 'MEDICATION_REMINDER'
  | 'SYSTEM'
  | 'TELEMED';

export type NotificationChannel = 'EMAIL' | 'PUSH' | 'SMS';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface Notification {
  id: string;
  user_id?: string;
  email?: string;
  type: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  is_read?: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// DTO: crear notificación
export interface CreateNotificationDTO {
  user_id?: string;
  email?: string;
  type: NotificationType;
  title: string;
  message: string;
  channel?: NotificationChannel;
  scheduled_at?: string | null;
  metadata?: Record<string, unknown>;
}

// DTO: actualizar estado
export interface UpdateNotificationStatusDTO {
  status: NotificationStatus;
  sent_at?: string;
}
