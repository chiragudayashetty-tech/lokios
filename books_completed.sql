-- SQL Script to create books_completed table for Chirag OS Proof of Work
CREATE TABLE IF NOT EXISTS books_completed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT DEFAULT 'Business',
  rating INTEGER DEFAULT 5,
  date_completed DATE DEFAULT CURRENT_DATE,
  cover_url TEXT,
  takeaways TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE books_completed ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own books"
  ON books_completed
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
