import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

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

    const normalizedEmail = email.toLowerCase();

    // Find user by email
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [normalizedEmail]
    );

    const user = userResult.rows[0];

    if (!user) {
      // If user doesn't exist, create the default admin user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const insertResult = await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
        [normalizedEmail, hashedPassword, 'admin']
      );

      const userId = insertResult.rows[0].id;

      // Generate token for new user
      const token = generateToken({
        email: normalizedEmail,
        userId: userId.toString(),
      });

      return NextResponse.json(
        {
          message: 'User created and signed in successfully',
          token,
          user: {
            email: normalizedEmail,
            role: 'admin',
          },
        },
        { status: 200 }
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateToken({
      email: user.email,
      userId: user.id.toString(),
    });

    return NextResponse.json(
      {
        message: 'Sign in successful',
        token,
        user: {
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Sign in error:', error);
    const errorMessage = error.message || 'An error occurred during sign in';
    
    // Check if it's a database connection error
    if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('connection')) {
      return NextResponse.json(
        { error: 'Database connection error. Please check your DATABASE_URL in .env.local' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

