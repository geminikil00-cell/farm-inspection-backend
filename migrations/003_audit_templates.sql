-- Forms Builder Migration
-- Adds audit templates table for dynamic form creation

CREATE TABLE IF NOT EXISTS audit_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'general',
  description TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  scoring_config JSONB NOT NULL DEFAULT '{"method":"percentage","pass_threshold":70}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_from UUID REFERENCES audit_templates(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_org ON audit_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON audit_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_category ON audit_templates(category);
