-- Multi-Tenant Foundation Migration
-- Adds organizations, roles, and scopes all data by org_id

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add columns to existing users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'auditor',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Role constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN (
        'super_admin', 'org_admin', 'auditor', 'dept_head', 'quality_mgr', 'viewer'
      ));
  END IF;
END $$;

-- 3. Add org_id to inspection_records
ALTER TABLE inspection_records
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_records_org ON inspection_records(org_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 4. Apply org_id to existing records (assign to a default org for migration)
-- This will be handled at deployment with the actual org
