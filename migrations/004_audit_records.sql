-- Audit Records Migration
-- Stores filled-out audit forms with responses and scores

CREATE TABLE IF NOT EXISTS audit_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES audit_templates(id),
  auditor_id UUID NOT NULL REFERENCES users(id),

  template_name TEXT NOT NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  template_category TEXT DEFAULT 'general',

  overall_score INTEGER DEFAULT 0,
  scoring_method TEXT DEFAULT 'percentage',
  pass_threshold INTEGER DEFAULT 70,
  passed BOOLEAN DEFAULT false,

  responses JSONB NOT NULL DEFAULT '[]',
  nc_flags INTEGER DEFAULT 0,

  site_name TEXT,
  inspector TEXT,
  audit_date DATE,

  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audits_org ON audit_records(org_id);
CREATE INDEX IF NOT EXISTS idx_audits_template ON audit_records(template_id);
CREATE INDEX IF NOT EXISTS idx_audits_auditor ON audit_records(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audit_records(status);
CREATE INDEX IF NOT EXISTS idx_audits_date ON audit_records(audit_date DESC);
