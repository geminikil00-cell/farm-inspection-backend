-- NC Records Migration
-- Non-conformance lifecycle tracking

CREATE TABLE IF NOT EXISTS nc_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES audit_records(id) ON DELETE SET NULL,

  nc_number TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Minor' CHECK (severity IN ('Critical','Major','Minor','Observation')),
  category TEXT DEFAULT 'general',

  section_ref TEXT,
  question_ref TEXT,
  description TEXT NOT NULL DEFAULT '',
  evidence_photos TEXT[] DEFAULT '{}',

  assigned_to UUID REFERENCES users(id),
  raised_by UUID REFERENCES users(id),

  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'assigned', 'in_progress', 'action_taken', 'under_review', 'closed', 'reopened'
  )),

  root_cause TEXT DEFAULT '',
  corrective_action TEXT DEFAULT '',
  verification_notes TEXT DEFAULT '',

  timeline JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nc_org ON nc_records(org_id);
CREATE INDEX IF NOT EXISTS idx_nc_status ON nc_records(status);
CREATE INDEX IF NOT EXISTS idx_nc_assigned ON nc_records(assigned_to);
CREATE INDEX IF NOT EXISTS idx_nc_raised ON nc_records(raised_by);
CREATE INDEX IF NOT EXISTS idx_nc_audit ON nc_records(audit_id);
CREATE INDEX IF NOT EXISTS idx_nc_severity ON nc_records(severity);
CREATE INDEX IF NOT EXISTS idx_nc_due ON nc_records(due_date);

-- Auto-generate NC numbers per org
CREATE SEQUENCE IF NOT EXISTS nc_number_seq;

CREATE OR REPLACE FUNCTION generate_nc_number()
RETURNS TRIGGER AS $$
DECLARE
  yr TEXT;
  seq INT;
BEGIN
  yr := to_char(NOW(), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(nc_number, '[^0-9]', '', 'g'), '')::int), 0) + 1
    INTO seq FROM nc_records WHERE org_id = NEW.org_id;
  NEW.nc_number := 'NC-' || yr || '-' || LPAD(seq::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_nc_number') THEN
    CREATE TRIGGER trg_nc_number
      BEFORE INSERT ON nc_records
      FOR EACH ROW
      EXECUTE FUNCTION generate_nc_number();
  END IF;
END $$;
