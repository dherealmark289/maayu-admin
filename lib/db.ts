import { Pool } from 'pg';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'your_database_url_here') {
  throw new Error('Please add your PostgreSQL URI to .env.local. DATABASE_URL is not set or is still the placeholder value.');
}

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('pooler') 
    ? { rejectUnauthorized: false } 
    : false,
});

// Test the connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
