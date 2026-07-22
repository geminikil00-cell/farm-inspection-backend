-- Departments table for unit-level organization

CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_departments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_org ON departments(org_id);
CREATE INDEX IF NOT EXISTS idx_udept_user ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_udept_dept ON user_departments(department_id);
