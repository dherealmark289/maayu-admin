import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3WithFolder } from '@/lib/s3';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import pool from '@/lib/db';

// POST - Upload vision image to S3
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
    const file = formData.get('file') as File;
    const zoneName = formData.get('zoneName') as string; // 'dao-home', 'lilac', 'mayu', or 'ecosystem'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type - accept all common image formats
    // First check if it's an image type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image file.' },
        { status: 400 }
      );
    }
    
    // Accept all image types that start with 'image/'
    // This allows JPEG, PNG, WebP, GIF, SVG, BMP, TIFF, ICO, and other image formats

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const safeZoneName = (zoneName || 'vision').replace(/[^a-z0-9-]/gi, '_').toLowerCase();
    const filename = `${safeZoneName}-${timestamp}-${randomString}.${extension}`;
    const folder = 'vision';

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToS3WithFolder(buffer, filename, file.type, folder);

    // Store image URL in media table with reference to vision content
    try {
      // Ensure media table has visionZoneName column
      try {
        await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "visionZoneName" VARCHAR(255)');
      } catch (e: any) {
        // Column might already exist, ignore
      }

      const mediaIdResult = await pool.query('SELECT gen_random_uuid()::text as id');
      const mediaId = mediaIdResult.rows[0].id;

      await pool.query(`
        INSERT INTO media (
          id, url, filename, "originalName", "mimeType", size, category, folder, "visionZoneName", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `, [
        mediaId,
        url,
        filename,
        file.name,
        file.type,
        buffer.length,
        'vision',
        folder,
        safeZoneName // Store which zone/card this image belongs to (dao-home, lilac, mayu, ecosystem)
      ]);
    } catch (mediaError: any) {
      // If media table doesn't exist or insert fails, continue anyway
      console.warn('Could not store media record:', mediaError.message);
    }

    return NextResponse.json({
      url,
      filename,
      success: true,
    });
  } catch (error: any) {
    console.error('Error uploading vision image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', details: error.message },
      { status: 500 }
    );
  }
}

