-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS patient_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  age VARCHAR(50) NOT NULL,
  transcript TEXT,
  summary TEXT,
  suggested_diagnosis TEXT,
  suggested_prescription TEXT,
  final_diagnosis TEXT NOT NULL,
  final_prescription TEXT NOT NULL,
  doctor_notes TEXT,
  document_url TEXT,
  media_urls TEXT[], -- New field for storing media URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);