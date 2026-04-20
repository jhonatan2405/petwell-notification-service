-- Migración para separar el estado de lectura (UX) del estado de envío (Email)
ALTER TABLE notifications
ADD COLUMN is_read BOOLEAN DEFAULT false;

-- Opcional: Asegurar que los registros existentes se inicialicen en false si es necesario
UPDATE notifications SET is_read = false WHERE is_read IS NULL;
