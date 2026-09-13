-- ==========================================================
-- Migration: Create Campus Locations Table & Seed Sample Data
-- Public campus room finder data (not scoped to user_id)
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.campus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_no TEXT NOT NULL,
  room_name TEXT NOT NULL,
  floor TEXT NOT NULL,
  building TEXT DEFAULT 'Main',
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance index for room lookups
CREATE INDEX IF NOT EXISTS idx_campus_locations_room_name ON public.campus_locations (room_name);
CREATE INDEX IF NOT EXISTS idx_campus_locations_room_no ON public.campus_locations (room_no);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campus_locations ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all authenticated and anonymous users
DROP POLICY IF EXISTS "Allow public read access on campus_locations" ON public.campus_locations;
CREATE POLICY "Allow public read access on campus_locations"
  ON public.campus_locations FOR SELECT
  USING (true);

-- ----------------------------------------------------------
-- Seed Initial Campus Locations Data
-- ----------------------------------------------------------
INSERT INTO public.campus_locations (room_no, room_name, floor, building, keywords)
VALUES
  (
    '1-01',
    'Library',
    'First Floor',
    'Main',
    ARRAY['library', 'central library', 'reading room', 'books', 'study hall', 'quiet area']
  ),
  (
    '2-01',
    'Computer Lab 1',
    'Second Floor',
    'Main',
    ARRAY['computer lab 1', 'computer lab', 'python lab', 'programming lab', 'cse lab', 'coding lab', 'cs lab']
  ),
  (
    'G-01',
    'Admission Cell',
    'Ground Floor',
    'Main',
    ARRAY['admission cell', 'admission office', 'admissions', 'admin office', 'registration', 'accounts desk']
  ),
  (
    'G-05',
    'Cafeteria',
    'Ground Floor',
    'Main',
    ARRAY['cafeteria', 'canteen', 'food court', 'mess', 'cafe', 'snacks', 'lunch']
  ),
  (
    '3-01',
    'Central Auditorium',
    'Third Floor',
    'Main',
    ARRAY['auditorium', 'central auditorium', 'seminar hall', 'main hall', 'audi', 'event hall']
  ),
  (
    '2-04',
    'Placement & Career Cell',
    'Second Floor',
    'Main',
    ARRAY['placement cell', 'career cell', 'training and placement', 'tnp', 'placement office', 'interview room']
  )
ON CONFLICT DO NOTHING;
