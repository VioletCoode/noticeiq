-- ==========================================================
-- Migration: Add alert_time and notified to tasks table
-- ==========================================================

-- 1. Add alert_time and notified columns if they do not exist
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS alert_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT false;

-- 2. Create composite index for the check-alerts Edge Function query
CREATE INDEX IF NOT EXISTS idx_tasks_alert_time_notified 
ON public.tasks (alert_time, notified);

-- 3. Comment on columns for documentation
COMMENT ON COLUMN public.tasks.alert_time IS 'Timestamp when student should be alerted via push notification';
COMMENT ON COLUMN public.tasks.notified IS 'Flag indicating whether the push notification alert was dispatched';
