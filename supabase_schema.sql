-- ==============================================================================
-- BSource Training - Complete Supabase Database Schema & Seed Script
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- Project: https://emylzqifahduucsdatlp.supabase.co
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables if re-running script cleanly
DROP TABLE IF EXISTS public.quiz_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.attendance_sessions CASCADE;
DROP TABLE IF EXISTS public.training_materials CASCADE;
DROP TABLE IF EXISTS public.trainings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'trainee' CHECK (role IN ('admin', 'trainer', 'trainee')),
  avatar_url TEXT,
  department TEXT DEFAULT 'Operations',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Trainings Table
CREATE TABLE public.trainings (
  id TEXT PRIMARY KEY DEFAULT ('trn-' || substr(md5(random()::text), 1, 8)),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trainer_id TEXT NOT NULL,
  trainer_name TEXT NOT NULL DEFAULT 'Trainer',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TEXT NOT NULL DEFAULT '10:00 AM',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT DEFAULT 'Virtual Suite Alpha',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'archived')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  allow_quiz_retries BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Training Materials Table
CREATE TABLE public.training_materials (
  id TEXT PRIMARY KEY DEFAULT ('mat-' || substr(md5(random()::text), 1, 8)),
  training_id TEXT NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  extracted_text TEXT DEFAULT '',
  chunks_count INTEGER NOT NULL DEFAULT 1,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Attendance Sessions Table (Rotating QR Codes)
CREATE TABLE public.attendance_sessions (
  id TEXT PRIMARY KEY DEFAULT ('sess-' || substr(md5(random()::text), 1, 8)),
  training_id TEXT NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  current_qr_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Attendance Records Table
CREATE TABLE public.attendance (
  id TEXT PRIMARY KEY DEFAULT ('att-' || substr(md5(random()::text), 1, 8)),
  session_id TEXT REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  training_id TEXT NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  trainee_id TEXT NOT NULL,
  trainee_name TEXT NOT NULL DEFAULT 'Trainee',
  trainee_email TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late')),
  verified_by_token TEXT NOT NULL
);

-- 8. Quizzes Table
CREATE TABLE public.quizzes (
  id TEXT PRIMARY KEY DEFAULT ('quiz-' || substr(md5(random()::text), 1, 8)),
  training_id TEXT NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE UNIQUE,
  title TEXT NOT NULL DEFAULT 'Training Assessment Quiz',
  description TEXT DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  total_questions INTEGER NOT NULL DEFAULT 4,
  passing_score INTEGER NOT NULL DEFAULT 70,
  time_limit_minutes INTEGER DEFAULT 15,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Questions Table
CREATE TABLE public.questions (
  id TEXT PRIMARY KEY DEFAULT ('q-' || substr(md5(random()::text), 1, 8)),
  quiz_id TEXT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL DEFAULT 1,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Quiz Attempts Table
CREATE TABLE public.quiz_attempts (
  id TEXT PRIMARY KEY DEFAULT ('att-sub-' || substr(md5(random()::text), 1, 8)),
  quiz_id TEXT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  training_id TEXT NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  trainee_id TEXT NOT NULL,
  trainee_name TEXT NOT NULL DEFAULT 'Trainee',
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 4,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed')),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Disable RLS or set open policies for seamless web app access
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on trainings" ON public.trainings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on training_materials" ON public.training_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance_sessions" ON public.attendance_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quizzes" ON public.quizzes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quiz_attempts" ON public.quiz_attempts FOR ALL USING (true) WITH CHECK (true);

-- 12. Realtime replication setup
ALTER PUBLICATION supabase_realtime ADD TABLE public.trainings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts;

-- ==============================================================================
-- 13. SEED INITIAL LIVE DATABASE DATA
-- ==============================================================================

-- Profiles
INSERT INTO public.profiles (id, email, full_name, role, department) VALUES
  ('usr_trainer_01', 'sarah.j@enterprise.internal', 'Sarah Jenkins', 'trainer', 'Global Security & Operations'),
  ('usr_trainee_01', 'alex.r@enterprise.internal', 'Alex Rivera', 'trainee', 'FinTech Engineering'),
  ('usr_trainee_02', 'liam.c@enterprise.internal', 'Liam Chen', 'trainee', 'Product Design'),
  ('usr_trainee_03', 'elena.r@enterprise.internal', 'Elena Rostova', 'trainee', 'Security Audit'),
  ('usr_admin_01', 'd.vance@enterprise.internal', 'David Vance', 'admin', 'Executive Governance & L&D')
ON CONFLICT (id) DO NOTHING;

-- Initial Trainings
INSERT INTO public.trainings (id, title, description, trainer_id, trainer_name, date, time, duration_minutes, location, status, is_published, allow_quiz_retries) VALUES
  ('trn-cyber-101', 'Cybersecurity Protocols & Zero-Trust Defense', 'Mandatory enterprise security baseline covering phishing detection, MFA governance, and session protection.', 'usr_trainer_01', 'Sarah Jenkins', CURRENT_DATE, '10:00 AM', 45, 'Virtual Suite Alpha (Zoom / Teams)', 'in_progress', TRUE, TRUE),
  ('trn-ai-201', 'Enterprise AI & LLM Systems Deployment', 'Guidelines on prompt governance, data privacy guardrails, and utilizing corporate AI assistants safely.', 'usr_trainer_01', 'Sarah Jenkins', CURRENT_DATE + INTERVAL '1 day', '02:00 PM', 60, 'Innovation Hall B-4 / Hybrid', 'upcoming', TRUE, TRUE),
  ('trn-iso-301', 'Cloud Compliance & ISO 27001 Standards', 'Annual corporate compliance audit readiness, data classification tiers, and customer data retention policy.', 'usr_trainer_01', 'Sarah Jenkins', CURRENT_DATE + INTERVAL '2 days', '11:00 AM', 90, 'Executive Conference Room 1', 'upcoming', TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Initial Active Attendance Session
INSERT INTO public.attendance_sessions (id, training_id, current_qr_token, is_active) VALUES
  ('sess-cyber-101', 'trn-cyber-101', 'TRN-SEC99', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Initial Quiz
INSERT INTO public.quizzes (id, training_id, title, description, difficulty, total_questions, passing_score, time_limit_minutes, is_published, questions) VALUES
  ('quiz-sec-101', 'trn-cyber-101', 'Cybersecurity Protocols Comprehension Assessment', 'Evaluate understanding of zero-trust architecture, phishing mitigation, and credential rotation.', 'Medium', 4, 70, 10, TRUE,
   '[
     {"id": "q1", "question": "What is the primary rule when receiving an unexpected email requesting urgent credentials confirmation?", "options": ["Verify through an independent communication channel and report to security", "Reply immediately with the requested details to prevent account lock", "Forward the email to all department members", "Ignore it completely and do not notify IT support"], "correctAnswer": 0, "explanation": "Always verify through out-of-band channels and report potential phishing attempts directly to InfoSec."},
     {"id": "q2", "question": "Under Zero-Trust architecture, which factor is verified during every access request?", "options": ["User identity, device health, and context-based authorization", "Only internal corporate IP address", "Single sign-on cookie without session revalidation", "Manager oral approval recorded annually"], "correctAnswer": 0, "explanation": "Zero-trust requires continuous verification of identity, device state, and contextual signals."},
     {"id": "q3", "question": "How frequently should multi-factor authentication (MFA) backup tokens be rotated or reviewed?", "options": ["Regularly, and immediately revoked upon device changes or suspicion", "Never, backup codes never expire once created", "Only when requested by external auditors", "Once every decade"], "correctAnswer": 0, "explanation": "MFA backups must be tightly governed and immediately revoked if compromised or when devices change."},
     {"id": "q4", "question": "Where should corporate customer records and proprietary code never be uploaded?", "options": ["Public unapproved consumer AI chat tools without enterprise data agreements", "Secure enterprise-managed code repositories", "Encrypted company cloud databases", "Authorized internal documentation wikis"], "correctAnswer": 0, "explanation": "Customer and proprietary assets must only reside within secure, enterprise-sanctioned environments."}
   ]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Initial Quiz Questions (normalized table)
INSERT INTO public.questions (id, quiz_id, question_order, question, options, correct_answer, explanation) VALUES
  ('q1', 'quiz-sec-101', 1, 'What is the primary rule when receiving an unexpected email requesting urgent credentials confirmation?', '["Verify through an independent communication channel and report to security", "Reply immediately with the requested details to prevent account lock", "Forward the email to all department members", "Ignore it completely and do not notify IT support"]'::jsonb, 0, 'Always verify through out-of-band channels and report potential phishing attempts directly to InfoSec.'),
  ('q2', 'quiz-sec-101', 2, 'Under Zero-Trust architecture, which factor is verified during every access request?', '["User identity, device health, and context-based authorization", "Only internal corporate IP address", "Single sign-on cookie without session revalidation", "Manager oral approval recorded annually"]'::jsonb, 0, 'Zero-trust requires continuous verification of identity, device state, and contextual signals.'),
  ('q3', 'quiz-sec-101', 3, 'How frequently should multi-factor authentication (MFA) backup tokens be rotated or reviewed?', '["Regularly, and immediately revoked upon device changes or suspicion", "Never, backup codes never expire once created", "Only when requested by external auditors", "Once every decade"]'::jsonb, 0, 'MFA backups must be tightly governed and immediately revoked if compromised or when devices change.'),
  ('q4', 'quiz-sec-101', 4, 'Where should corporate customer records and proprietary code never be uploaded?', '["Public unapproved consumer AI chat tools without enterprise data agreements", "Secure enterprise-managed code repositories", "Encrypted company cloud databases", "Authorized internal documentation wikis"]'::jsonb, 0, 'Customer and proprietary assets must only reside within secure, enterprise-sanctioned environments.')
ON CONFLICT (id) DO NOTHING;
