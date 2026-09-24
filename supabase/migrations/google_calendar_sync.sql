-- Google Calendar sync columns
-- Run this in your Supabase SQL Editor

-- Add Google OAuth token storage to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token  TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id    TEXT DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_connected_at   TIMESTAMPTZ;

-- Add Google event ID to calendar_events (to track which local event = which Google event)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event_id
  ON calendar_events(google_event_id)
  WHERE google_event_id IS NOT NULL;
