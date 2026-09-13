-- ==========================================================
-- NoticeIQ Full Database Schema & Row Level Security (RLS)
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 1. NOTICES TABLE
-- Stores raw captured notices (text, image, PDF references)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  raw_text TEXT,
  source_type TEXT DEFAULT 'text' CHECK (source_type IN ('text', 'image', 'pdf', 'manual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------
-- 2. TASKS TABLE
-- Stores actionable items extracted from notices or created manually
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notice_id UUID REFERENCES public.notices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  deadline TIMESTAMPTZ,
  audience TEXT DEFAULT 'All Students',
  requirements TEXT[] DEFAULT '{}',
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  confidence NUMERIC(4,2) DEFAULT 0.95,
  alert_time TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------
-- 3. REMINDERS TABLE
-- Stores scheduled alerts for tasks
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  fire_time TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  notification_type TEXT DEFAULT 'push' CHECK (notification_type IN ('push', 'in_app', 'email')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------
-- 4. DOCUMENTS TABLE (CAMPUS VAULT)
-- Stores metadata for uploaded student credentials & files
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------
-- 5. PROFILES TABLE
-- Stores student digital ID info and professional/social URLs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT DEFAULT 'Student',
  institution_name TEXT DEFAULT 'Apex Institute of Technology',
  department TEXT DEFAULT 'Computer Science & Engineering',
  student_id TEXT DEFAULT 'CS-2024-8942',
  photo_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  leetcode_url TEXT,
  kaggle_url TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  custom_links JSONB DEFAULT '[]'::jsonb,
  summary_bio TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  work_experience JSONB DEFAULT '[]'::jsonb,
  projects JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  languages JSONB DEFAULT '[]'::jsonb,
  availability_status TEXT DEFAULT 'Open to opportunities',
  onesignal_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Migration for existing databases:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution_name text DEFAULT 'Apex Institute of Technology';
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_url text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS youtube_url text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS twitter_url text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_url text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_links jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS summary_bio text;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_experience jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS projects jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages jsonb DEFAULT '[]'::jsonb;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'Open to opportunities';

-- ----------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notices_user_id ON public.notices(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_alert_time_notified ON public.tasks(alert_time, notified);
CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON public.reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_reminders_fire_time ON public.reminders(fire_time, sent);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ----------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict isolation: users can ONLY view and modify their own data
-- ----------------------------------------------------------

-- 1. Notices RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notices"
  ON public.notices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notices"
  ON public.notices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notices"
  ON public.notices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notices"
  ON public.notices FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Tasks RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Reminders RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
  ON public.reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = reminders.task_id 
        AND tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = reminders.task_id 
        AND tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own reminders"
  ON public.reminders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = reminders.task_id 
        AND tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own reminders"
  ON public.reminders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = reminders.task_id 
        AND tasks.user_id = auth.uid()
    )
  );

-- 4. Documents RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKET & RLS POLICIES
-- Bucket 'campus_vault' stores uploaded documents and ID photos
-- ----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('campus_vault', 'campus_vault', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Users can upload their own vault files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'campus_vault' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own vault files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'campus_vault' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own vault files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'campus_vault' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own vault files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'campus_vault' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------
-- 7. AUTOMATIC USER INITIALIZATION TRIGGER
-- Automatically creates a default profile upon user sign-up
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_name TEXT;
BEGIN
  default_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Student'
  );

  INSERT INTO public.profiles (
    user_id,
    name,
    student_id,
    department
  ) VALUES (
    NEW.id,
    default_name,
    'CS-2024-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'),
    'Computer Science & Engineering'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------
-- 8. CAMPUS LOCATIONS TABLE (ROOM FINDER)
-- Public campus room & facility directory
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_no TEXT NOT NULL,
  room_name TEXT NOT NULL,
  floor TEXT NOT NULL,
  building TEXT DEFAULT 'Main',
  keywords TEXT[] DEFAULT '{}',
  floor_plan_url TEXT,
  marker_x FLOAT,
  marker_y FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for room lookups
CREATE INDEX IF NOT EXISTS idx_campus_locations_room_name ON public.campus_locations (room_name);
CREATE INDEX IF NOT EXISTS idx_campus_locations_room_no ON public.campus_locations (room_no);

-- Row Level Security (RLS)
ALTER TABLE public.campus_locations ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all users
DROP POLICY IF EXISTS "Allow public read access on campus_locations" ON public.campus_locations;
CREATE POLICY "Allow public read access on campus_locations"
  ON public.campus_locations FOR SELECT
  USING (true);

-- Seed campus locations with marker coordinates (percentages 0-100)
INSERT INTO public.campus_locations (room_no, room_name, floor, building, keywords, marker_x, marker_y)
VALUES
  ('1-01', 'Library', 'First Floor', 'Main', ARRAY['library', 'central library', 'reading room', 'books', 'study hall', 'quiet area'], 52.0, 38.0),
  ('2-01', 'Computer Lab 1', 'Second Floor', 'Main', ARRAY['computer lab 1', 'computer lab', 'python lab', 'programming lab', 'cse lab', 'coding lab', 'cs lab'], 74.5, 62.0),
  ('G-01', 'Admission Cell', 'Ground Floor', 'Main', ARRAY['admission cell', 'admission office', 'admissions', 'admin office', 'registration', 'accounts desk'], 28.0, 45.0),
  ('G-05', 'Cafeteria', 'Ground Floor', 'Main', ARRAY['cafeteria', 'canteen', 'food court', 'mess', 'cafe', 'snacks', 'lunch'], 80.0, 75.0),
  ('3-01', 'Central Auditorium', 'Third Floor', 'Main', ARRAY['auditorium', 'central auditorium', 'seminar hall', 'main hall', 'audi', 'event hall'], 50.0, 50.0),
  ('2-04', 'Placement & Career Cell', 'Second Floor', 'Main', ARRAY['placement cell', 'career cell', 'training and placement', 'tnp', 'placement office', 'interview room'], 42.0, 58.0)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------
-- 9. CAMPUS BLUEPRINTS STORAGE BUCKET
-- Public floor plan blueprints
-- ----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('campus_blueprints', 'campus_blueprints', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access for campus_blueprints" ON storage.objects;
CREATE POLICY "Public read access for campus_blueprints"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campus_blueprints');


