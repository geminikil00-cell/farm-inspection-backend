-- Audit Assignments for Auditor Portal

CREATE TABLE IF NOT EXISTS audit_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES audit_templates(id),
  auditor_id UUID NOT NULL REFERENCES users(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  audit_record_id UUID REFERENCES audit_records(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  due_date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assign_org ON audit_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_assign_auditor ON audit_assignments(auditor_id);
CREATE INDEX IF NOT EXISTS idx_assign_status ON audit_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assign_template ON audit_assignments(template_id);
