-- Migración: Añadir campo de email y permitir user_id nulo para la tabla notifications

-- 1. Añadir el campo email
ALTER TABLE notifications ADD COLUMN email VARCHAR(255);

-- 2. Permitir que user_id sea nulo (ya que ahora podemos enviar a un email directo)
ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;
