import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ErrorHandler]', error.message);

  const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;

  res.status(statusCode).json({
    success: false,
    message: error.message ?? 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}
