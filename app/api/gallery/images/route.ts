import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { uploadToS3, deleteFromS3 } from '@/lib/s3';

// GET - Fetch images for a specific album
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get('albumId');

    if (!albumId) {
      return NextResponse.json(
        { error: 'Album ID is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(`
      SELECT * FROM gallery_images 
      WHERE "albumId" = $1
      ORDER BY "order" ASC, "createdAt" DESC
    `, [albumId]);

    return NextResponse.json(
      {
        images: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get gallery images error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching gallery images', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Upload image to a gallery album
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
    const albumId = formData.get('albumId') as string;
    const alt = formData.get('alt') as string;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!albumId) {
      return NextResponse.json(
        { error: 'Album ID is required' },
        { status: 400 }
      );
    }

    // Verify album exists and get album name
    const albumResult = await pool.query('SELECT name FROM gallery_albums WHERE id = $1', [albumId]);
    if (albumResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Album not found' },
        { status: 404 }
      );
    }

    const albumName = albumResult.rows[0].name;
    // Generate slug from album name for folder
    const albumSlug = albumName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const extension = originalName.split('.').pop();
    const filename = `${timestamp}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3 in gallery/album-slug/ folder
    const s3Folder = `gallery/${albumSlug}` as any;
    const url = await uploadToS3(buffer, filename, file.type, s3Folder);

    // Generate UUID for the image record
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const imageId = idResult.rows[0].id;

    // Get current max order for this album
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX("order"), 0) + 1 as "nextOrder" FROM gallery_images WHERE "albumId" = $1',
      [albumId]
    );
    const nextOrder = orderResult.rows[0]?.nextOrder || 1;

    // Insert image record
    const result = await pool.query(`
      INSERT INTO gallery_images (id, "albumId", filename, "originalName", "mimeType", size, url, alt, description, "uploadedBy", "order", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      imageId,
      albumId,
      filename,
      originalName,
      file.type,
      file.size,
      url,
      alt || null,
      description || null,
      payload.email,
      nextOrder,
    ]);

    // Update album image count
    await pool.query(
      'UPDATE gallery_albums SET "imageCount" = "imageCount" + 1 WHERE id = $1',
      [albumId]
    );

    // Update cover image if album doesn't have one
    await pool.query(`
      UPDATE gallery_albums 
      SET "coverImageUrl" = $1 
      WHERE id = $2 AND "coverImageUrl" IS NULL
    `, [url, albumId]);

    // Also store in media table for media library
    try {
      // Ensure media table exists and has gallery columns
      try {
        await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS folder VARCHAR(255)');
        await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS category VARCHAR(255)');
      } catch (e: any) {
        // Columns might already exist, ignore
      }

      // Check if already exists in media table
      const existingMedia = await pool.query('SELECT id FROM media WHERE url = $1 LIMIT 1', [url]);
      
      if (existingMedia.rows.length === 0) {
        const mediaIdResult = await pool.query('SELECT gen_random_uuid()::text as id');
        const mediaId = mediaIdResult.rows[0].id;

        await pool.query(`
          INSERT INTO media (
            id, url, filename, "originalName", "mimeType", size, category, folder, "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING
        `, [
          mediaId,
          url,
          filename,
          originalName,
          file.type,
          file.size,
          'gallery', // Category
          'gallery', // Folder
        ]);
      }
    } catch (mediaError: any) {
      // If media table insert fails, log but don't fail the upload
      console.warn('Could not store gallery image in media table:', mediaError.message);
    }

    return NextResponse.json(
      {
        message: 'Image uploaded successfully',
        image: result.rows[0]
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Upload gallery image error:', error);
    return NextResponse.json(
      { error: 'An error occurred while uploading image', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a gallery image
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Get image details before deleting
    const imageResult = await pool.query(
      'SELECT url, "albumId" FROM gallery_images WHERE id = $1',
      [id]
    );

    if (imageResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    const imageUrl = imageResult.rows[0].url;
    const albumId = imageResult.rows[0].albumId;

    // Delete from S3
    try {
      await deleteFromS3(imageUrl);
    } catch (s3Error: any) {
      console.error('Error deleting from S3:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await pool.query('DELETE FROM gallery_images WHERE id = $1', [id]);

    // Update album image count
    await pool.query(
      'UPDATE gallery_albums SET "imageCount" = "imageCount" - 1 WHERE id = $1',
      [albumId]
    );

    // If this was the cover image, set the first remaining image as cover
    await pool.query(`
      UPDATE gallery_albums 
      SET "coverImageUrl" = (
        SELECT url FROM gallery_images 
        WHERE "albumId" = $1 
        ORDER BY "order" ASC, "createdAt" ASC 
        LIMIT 1
      )
      WHERE id = $1
    `, [albumId]);

    return NextResponse.json(
      { message: 'Image deleted successfully', deletedId: id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete gallery image error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting image', details: error.message },
      { status: 500 }
    );
  }
}

