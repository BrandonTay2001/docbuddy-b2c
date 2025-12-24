-- Add media_urls column to existing patient_sessions table
ALTER TABLE patient_sessions 
ADD COLUMN IF NOT EXISTS media_urls TEXT[];
