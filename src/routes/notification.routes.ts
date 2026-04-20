import { Router } from 'express';
import {
  createNotification,
  getNotifications,
  updateNotificationStatus,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller';
import {
  authenticateToken,
  authenticateOrPublic,
} from '../middlewares/auth.middleware';

const router = Router();

/**
 * POST /api/v1/notifications
 * Crear una notificación.
 *
 * Middleware: authenticateOrPublic
 *   - Con JWT  → usuario autenticado (flujo normal)
 *   - Sin JWT  → permitido SOLO si el body tiene `email` y type SYSTEM|AUTH
 *                (usado por User Service para verificación y registro)
 */
router.post('/', authenticateOrPublic, createNotification);

/**
 * GET /api/v1/notifications
 * Listar notificaciones del usuario autenticado.
 * Siempre requiere JWT.
 * Query params: limit (default 20), offset (default 0)
 */
router.get('/', authenticateToken, getNotifications);

/**
 * PATCH /api/v1/notifications/:id/status
 * Actualizar el estado de una notificación (SENT | FAILED).
 * Siempre requiere JWT.
 */
router.patch('/:id/status', authenticateToken, updateNotificationStatus);

/**
 * PATCH /api/v1/notifications/read-all
 * Marca todas las notificaciones del usuario como leídas.
 */
router.patch('/read-all', authenticateToken, markAllAsRead);

/**
 * PATCH /api/v1/notifications/:id/read
 * Marca la notificación como leída por el usuario final (UX).
 */
router.patch('/:id/read', authenticateToken, markAsRead);

export default router;
