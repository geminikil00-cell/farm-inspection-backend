-- Farm Inspection Tool - PostgreSQL Migration
-- Run with: npm run migrate (or manually via psql)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inspection records table
CREATE TABLE IF NOT EXISTS inspection_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL,
  facility_title TEXT NOT NULL,
  inspector TEXT NOT NULL,
  date DATE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  inspection_year INTEGER,
  inspection_quarter TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  photo_paths TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_records_user ON inspection_records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_facility ON inspection_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON inspection_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_records_year_quarter ON inspection_records(inspection_year, inspection_quarter);
