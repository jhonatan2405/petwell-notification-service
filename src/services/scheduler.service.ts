import cron from 'node-cron';
import { NotificationService } from './notification.service';

const notificationService = new NotificationService();

/**
 * Scheduler principal.
 * Se ejecuta cada minuto y procesa las notificaciones PENDING vencidas.
 *
 * Expresión cron: * * * * *  → cada minuto
 */
export function startScheduler(): void {
  console.log('[Scheduler] 🕐 Iniciando scheduler de notificaciones...');

  cron.schedule('* * * * *', async () => {
    try {
      await notificationService.processPendingNotifications();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] ❌ Error en ciclo del scheduler: ${msg}`);
    }
  });

  console.log('[Scheduler] ✅ Scheduler activo — ejecutando cada minuto');
}
