-- ============================================================
-- PetWell — Notification Service
-- Row Level Security (RLS) policies
-- Tabla: notifications
--
-- Ejecutar en Supabase SQL Editor DESPUÉS de schema.sql
-- ============================================================
--
-- ⚠️  IMPORTANTE — Por qué esto es seguro para tus microservicios:
--
--   El notification-service usa SUPABASE_SERVICE_ROLE_KEY.
--   El service role bypassa RLS automáticamente en Supabase.
--   → Los INSERTs de notificaciones (recordatorios de citas,
--     vacunas, cumpleaños), los UPDATEs de estado (PENDING →
--     SENT / FAILED) y todos los schedulers/workers existentes
--     siguen funcionando sin ningún cambio.
--
--   Estas políticas solo afectan acceso directo vía:
--     • Clave ANON (acceso público no autenticado)
--     • Tokens JWT de usuarios (frontend / PostgREST)
--
-- Claims JWT:
--   auth.uid()        → UUID del usuario autenticado (= user_id)
--   jwt_claim('role') → DUENO_MASCOTA | CLINIC_ADMIN | VETERINARIO
-- ============================================================

-- Helper jwt_claim (idempotente — compatible con todos los servicios)
CREATE OR REPLACE FUNCTION public.jwt_claim(claim TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json ->> claim,
    ''
  );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- TABLA: notifications
-- Reglas de acceso:
--   SELECT : Cada usuario solo ve SUS PROPIAS notificaciones (user_id)
--            CLINIC_ADMIN puede ver notificaciones de su clínica
--            (el campo metadata puede contener clinic_id si aplica)
--   INSERT : ⛔ Bloqueado para clientes directos
--            (solo el notification-service con service_role inserta)
--   UPDATE : El usuario puede actualizar SUS PROPIAS notificaciones
--            (por ejemplo: marcar como leída vía is_read)
--            El microservicio actualiza estado con service_role (bypass)
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores (idempotente)
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;

-- SELECT ─────────────────────────────────────────────────────
-- Cada usuario solo puede leer sus propias notificaciones.
CREATE POLICY "notifications_select"
ON notifications FOR SELECT
USING (
  auth.uid() = user_id
);

-- INSERT ─────────────────────────────────────────────────────
-- Las notificaciones solo las crea el notification-service internamente
-- usando service_role. Se bloquea cualquier intento de inserción directa
-- desde el frontend o acceso anon.
CREATE POLICY "notifications_insert"
ON notifications FOR INSERT
WITH CHECK (false);

-- UPDATE ─────────────────────────────────────────────────────
-- Un usuario autenticado puede actualizar SOLO sus propias notificaciones.
-- Caso de uso principal: marcar notificación como leída (campo is_read / status).
-- El microservicio actualiza estado con service_role (bypass automático).
CREATE POLICY "notifications_update"
ON notifications FOR UPDATE
USING (
  auth.uid() = user_id
);

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

-- Estado RLS:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename = 'notifications';

-- Políticas activas:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'notifications'
-- ORDER BY cmd;
