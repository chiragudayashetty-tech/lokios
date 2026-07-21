-- Add topic and done_at columns to brain_dump table
ALTER TABLE brain_dump
ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;

-- Update existing records to have 'General' topic if null
UPDATE brain_dump SET topic = 'General' WHERE topic IS NULL;

-- Update status 'organized' or 'converted' to 'done' for backwards compat
UPDATE brain_dump SET status = 'done' WHERE status IN ('organized', 'converted');
