import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { uploadToS3WithFolder } from '@/lib/s3';
import pool from '@/lib/db';

// POST - Upload accommodation image to S3
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;
    const accommodationId = formData.get('accommodationId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const filename = `${timestamp}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3 in accommodation folder
    const url = await uploadToS3WithFolder(buffer, filename, file.type, 'accommodation');

    // Also save to media database with accommodation category
    try {
      const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
      const mediaId = idResult.rows[0].id;

      // Add accommodationId column if it doesn't exist
      try {
        await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "accommodationId" VARCHAR(255)');
      } catch (e: any) {}

      await pool.query(`
        INSERT INTO media (id, filename, "originalName", "mimeType", size, url, category, "accommodationId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `, [
        mediaId,
        filename,
        originalName,
        file.type,
        file.size,
        url,
        'accommodation',
        accommodationId || null,
      ]);
    } catch (dbError) {
      console.error('Error saving to media database:', dbError);
      // Continue even if database save fails
    }

    return NextResponse.json(
      {
        message: 'Image uploaded successfully',
        url: url,
        filename: filename
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Upload accommodation image error:', error);
    return NextResponse.json(
      { error: 'An error occurred while uploading image', details: error.message },
      { status: 500 }
    );
  }
}

