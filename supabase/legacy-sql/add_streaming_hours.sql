-- Add streaming_hours column to screen_time_logs table
ALTER TABLE screen_time_logs
ADD COLUMN IF NOT EXISTS streaming_hours NUMERIC DEFAULT 0;
