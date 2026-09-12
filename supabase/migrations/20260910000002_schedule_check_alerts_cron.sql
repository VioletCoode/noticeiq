-- ==============================================================================
-- Migration: Schedule check-alerts Edge Function via pg_cron & pg_net
-- Frequency: Every 5 minutes ('*/5 * * * *')
-- ==============================================================================

-- 1. Enable required extensions for scheduled HTTP triggers
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Unschedule any existing cron job with the old or current name to avoid duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-alerts-every-5-mins') THEN
    PERFORM cron.unschedule('check-alerts-every-5-mins');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-alerts-every-1-min') THEN
    PERFORM cron.unschedule('check-alerts-every-1-min');
  END IF;
END $$;

-- 3. Schedule the check-alerts Edge Function to execute every 1 minute
-- NOTE: Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> with your actual project credentials,
-- or use the Supabase Dashboard > Edge Functions > check-alerts > Schedule settings.
SELECT cron.schedule(
  'check-alerts-every-1-min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_OR_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
