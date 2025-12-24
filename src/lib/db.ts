import { Pool } from 'pg';

// Ensure we're using pure JavaScript implementation
process.env.NODE_PG_FORCE_NATIVE = '0';

// Create a new pool using the connection string from environment variables
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Heroku
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
})