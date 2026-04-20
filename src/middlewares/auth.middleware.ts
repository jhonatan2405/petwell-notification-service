import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: string;
  sub?: string;
  email: string;
  role?: string;
}

// Tipos de notificación que pueden enviarse sin JWT (flujos de autenticación)
const PUBLIC_NOTIFICATION_TYPES = ['SYSTEM', 'AUTH'] as const;

// Extiende Request para incluir el userId decodificado
declare global {
  namespace Express {
    interface Request {
      userId: string;
      userEmail?: string;
      userRole?: string;
    }
  }
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  console.log("Authorization:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token requerido" });
    return;
  }

  const token = authHeader.split(" ")[1];
  console.log("Token limpio:", token);

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "JWT_SECRET no configurado" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    console.log("Decoded:", decoded);

    // Inyectar en request
    req.userId = decoded.sub || decoded.id;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;
    
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ message: "Token expirado" });
    } else {
      res.status(401).json({ message: "Token inválido" });
    }
  }
}

/**
 * Middleware flexible para el endpoint POST /notifications.
 *
 * - Si hay Authorization header → valida JWT (flujo normal de usuario autenticado)
 * - Si NO hay Authorization → permite el request SOLO si:
 *     • el body contiene un campo `email` (hay destinatario explícito)
 *     • el campo `type` es SYSTEM o AUTH (flujos de registro/verificación)
 *
 * Esto evita exponer el endpoint completamente y lo restringe a
 * casos de uso legítimos sin token (User Service → verificación de cuenta).
 */
export function authenticateOrPublic(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.log("Authorization:", req.headers.authorization);
  const authHeader = req.headers.authorization;

  // ── Con token: validación JWT estándar ────────────────────────────────────
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({ message: "JWT_SECRET no configurado" });
      return;
    }

    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      
      req.userId    = decoded.sub || decoded.id;
      req.userEmail = decoded.email;
      req.userRole  = decoded.role;
      return next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ message: "Token expirado" });
      } else {
        res.status(401).json({ message: "Token inválido" });
      }
      return;
    }
  }

  // ── Sin token: solo flujos públicos permitidos ────────────────────────────
  const { email, type } = req.body as { email?: string; type?: string };

  const isPublicType = PUBLIC_NOTIFICATION_TYPES.includes(
    type as (typeof PUBLIC_NOTIFICATION_TYPES)[number]
  );

  if (email && isPublicType) {
    // Marcar request como invocación interna (sin userId)
    req.userId    = '';
    req.userEmail = email;
    return next();
  }

  res.status(401).json({
    success: false,
    message: 'Token requerido. Sin JWT solo se permiten notificaciones de tipo SYSTEM o AUTH con email explícito.',
  });
}
