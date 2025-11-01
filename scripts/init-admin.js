/**
 * Script to initialize the admin user
 * Run with: node scripts/init-admin.js
 * Make sure your .env.local file is set up with DATABASE_URL
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_EMAIL = 'mar@markxquadros.com';
const ADMIN_PASSWORD = 'Daohome@289!!';

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase') || DATABASE_URL.includes('pooler') 
    ? { rejectUnauthorized: false } 
    : false,
});

async function initAdmin() {
  try {
    console.log('Connecting to database...');
    
    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table ready');

    const normalizedEmail = ADMIN_EMAIL.toLowerCase();

    // Check if admin user already exists
    const existingUserResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUserResult.rows.length > 0) {
      console.log('Admin user already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await pool.query(
        'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [hashedPassword, normalizedEmail]
      );
      console.log('Admin password updated successfully!');
    } else {
      console.log('Creating admin user...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
        [normalizedEmail, hashedPassword, 'admin']
      );
      console.log('Admin user created successfully!');
    }

    console.log(`\nAdmin credentials:`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}\n`);
  } catch (error) {
    console.error('Error initializing admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

initAdmin();
