-- ============================================================
-- PetWell - Notification Service
-- Schema: notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL,
  type          VARCHAR(50)   NOT NULL
    CHECK (type IN ('APPOINTMENT_REMINDER', 'VACCINE_REMINDER', 'BIRTHDAY_REMINDER', 'MEDICATION_REMINDER', 'SYSTEM', 'TELEMED')),
  title         VARCHAR(255)  NOT NULL,
  message       TEXT          NOT NULL,
  channel       VARCHAR(20)   NOT NULL DEFAULT 'EMAIL'
    CHECK (channel IN ('EMAIL', 'PUSH', 'SMS')),
  status        VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status      ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications (scheduled_at);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();
