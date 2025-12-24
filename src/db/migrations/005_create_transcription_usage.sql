-- Create transcription_usage table
CREATE TABLE IF NOT EXISTS transcription_usage (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  minutes_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, year, month)
);

-- Create index for faster lookups
CREATE INDEX idx_transcription_usage_user_year_month 
ON transcription_usage(user_id, year, month); 