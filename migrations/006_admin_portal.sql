-- System Admin Portal: Messages, Notifications, Template Types

-- 1. Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_participants (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_contents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_contents_msg ON message_contents(message_id);
CREATE INDEX IF NOT EXISTS idx_msg_participants_user ON message_participants(user_id);

-- 2. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT DEFAULT '',
  type TEXT DEFAULT 'general' CHECK (type IN ('audit_submitted','template_published','nc_updated','general')),
  tone TEXT DEFAULT 'info' CHECK (tone IN ('success','warning','info')),
  read_status BOOLEAN DEFAULT false,
  related_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(recipient_id, read_status);

-- 3. Template type column for table-format support
ALTER TABLE audit_templates
  ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'form' CHECK (template_type IN ('form', 'table'));

ALTER TABLE audit_templates
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_templates_type ON audit_templates(template_type);
