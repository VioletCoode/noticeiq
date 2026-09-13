-- ==========================================================
-- Migration: Add Floor Plan Blueprint Storage & Markers
-- Table: campus_locations (floor_plan_url, marker_x, marker_y)
-- Bucket: campus_blueprints (public read access)
-- ==========================================================

-- 1. Create Public Storage Bucket for Floor Blueprints
INSERT INTO storage.buckets (id, name, public)
VALUES ('campus_blueprints', 'campus_blueprints', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS policy: Public read access without authentication
DROP POLICY IF EXISTS "Public read access for campus_blueprints" ON storage.objects;
CREATE POLICY "Public read access for campus_blueprints"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campus_blueprints');

-- 2. Alter campus_locations table
ALTER TABLE public.campus_locations
  ADD COLUMN IF NOT EXISTS floor_plan_url TEXT,
  ADD COLUMN IF NOT EXISTS marker_x FLOAT,
  ADD COLUMN IF NOT EXISTS marker_y FLOAT;

-- 3. Update Existing Seed Data with Marker Percentage Coordinates (0 - 100%)
UPDATE public.campus_locations
SET 
  marker_x = 52.0,
  marker_y = 38.0
WHERE room_name = 'Library';

UPDATE public.campus_locations
SET 
  marker_x = 74.5,
  marker_y = 62.0
WHERE room_name = 'Computer Lab 1';

UPDATE public.campus_locations
SET 
  marker_x = 28.0,
  marker_y = 45.0
WHERE room_name = 'Admission Cell';

UPDATE public.campus_locations
SET 
  marker_x = 80.0,
  marker_y = 75.0
WHERE room_name = 'Cafeteria';

UPDATE public.campus_locations
SET 
  marker_x = 50.0,
  marker_y = 50.0
WHERE room_name = 'Central Auditorium';

UPDATE public.campus_locations
SET 
  marker_x = 42.0,
  marker_y = 58.0
WHERE room_name = 'Placement & Career Cell';
