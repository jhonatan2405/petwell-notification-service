import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { CreateNotificationDTO, NotificationStatus } from '../models/notification.model';

const service = new NotificationService();

// ─── POST /notifications ─────────────────────────────────────────────────────

export async function createNotification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extraemos userId del token, pero si viene en el body lo aceptamos (para peticiones s2s)
    const tokenUserId = (req as Request & { userId?: string }).userId;
    
    const dto: CreateNotificationDTO = {
      user_id: req.body.user_id || tokenUserId,
      email: req.body.email,
      type: req.body.type,
      title: req.body.title,
      message: req.body.message,
      channel: req.body.channel,
      scheduled_at: req.body.scheduled_at ?? null,
      metadata: req.body.metadata,
    };

    // Validaciones básicas
    if (!dto.type || !dto.title || !dto.message) {
      sendError(res, 'type, title y message son requeridos', 400);
      return;
    }

    const notification = await service.createNotification(dto);
    sendSuccess(res, notification, 'Notificación creada exitosamente', 201);
  } catch (error) {
    next(error);
  }
}

// ─── GET /notifications ───────────────────────────────────────────────────────

export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId: string = (req as Request & { userId: string }).userId;
    
    console.log("👤 user desde JWT:", userId);

    if (!userId) {
      sendError(res, 'Usuario no autenticado (user_id no presente o undefined)', 401);
      return;
    }

    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    const notifications = await service.getNotificationsByUser(userId, limit, offset);
    sendSuccess(res, notifications, 'Notificaciones obtenidas exitosamente');
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /notifications/:id/status ─────────────────────────────────────────

export async function updateNotificationStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: NotificationStatus };

    const validStatuses: NotificationStatus[] = ['PENDING', 'SENT', 'FAILED'];
    if (!status || !validStatuses.includes(status)) {
      sendError(res, `status debe ser uno de: ${validStatuses.join(', ')}`, 400);
      return;
    }

    const updated = await service.updateNotificationStatus(id, {
      status,
      sent_at: status === 'SENT' ? new Date().toISOString() : undefined,
    });

    sendSuccess(res, updated, 'Estado actualizado exitosamente');
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /notifications/:id/read ─────────────────────────────────────────

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const result = await service.markNotificationAsRead(id, userId);
    res.json(result);
  } catch (error) {
    console.error("Error markAsRead:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// ─── PATCH /notifications/read-all ─────────────────────────────────────────

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const result = await service.markAllNotificationsAsRead(userId);
    res.json(result);
  } catch (error) {
    console.error("Error markAllAsRead:", error);
    res.status(500).json({ message: "Error interno" });
  }
};
