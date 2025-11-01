import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// GET - Fetch all gallery albums
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

    // Create gallery_albums table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gallery_albums (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        "coverImageUrl" VARCHAR(500),
        "imageCount" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create gallery_images table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gallery_images (
        id VARCHAR(255) PRIMARY KEY,
        "albumId" VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        "originalName" VARCHAR(255) NOT NULL,
        "mimeType" VARCHAR(255) NOT NULL,
        size INTEGER NOT NULL,
        url VARCHAR(500) NOT NULL,
        alt TEXT,
        description TEXT,
        "uploadedBy" VARCHAR(255),
        "order" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("albumId") REFERENCES gallery_albums(id) ON DELETE CASCADE
      )
    `);

    // Fetch all albums with image counts
    const result = await pool.query(`
      SELECT 
        a.*,
        COUNT(gi.id) as "actualImageCount"
      FROM gallery_albums a
      LEFT JOIN gallery_images gi ON a.id = gi."albumId"
      GROUP BY a.id
      ORDER BY a."createdAt" DESC
    `);

    // Update imageCount in albums to match actual count
    for (const album of result.rows) {
      if (album.actualImageCount !== album.imageCount) {
        await pool.query(
          'UPDATE gallery_albums SET "imageCount" = $1 WHERE id = $2',
          [album.actualImageCount, album.id]
        );
      }
    }

    return NextResponse.json(
      {
        albums: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get gallery albums error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching gallery albums', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new gallery album
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

    const body = await request.json();
    const { name, description, coverImageUrl } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Album name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name for folder
    const albumSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Generate UUID
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const albumId = idResult.rows[0].id;

    // Insert album
    const result = await pool.query(`
      INSERT INTO gallery_albums (id, name, description, "coverImageUrl", "imageCount", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      albumId,
      name.trim(),
      description || null,
      coverImageUrl || null,
    ]);

    return NextResponse.json(
      {
        message: 'Gallery album created successfully',
        album: result.rows[0],
        albumSlug, // Return slug for frontend to use in uploads
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create gallery album error:', error);
    // Check for unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'An album with this name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'An error occurred while creating gallery album', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a gallery album
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { id, name, description, coverImageUrl } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Album ID is required' },
        { status: 400 }
      );
    }

    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      params.push(description || null);
    }
    if (coverImageUrl !== undefined) {
      updateFields.push(`"coverImageUrl" = $${paramIndex++}`);
      params.push(coverImageUrl || null);
    }

    updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await pool.query(`
      UPDATE gallery_albums 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Gallery album not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Gallery album updated successfully',
        album: result.rows[0]
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update gallery album error:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'An album with this name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'An error occurred while updating gallery album', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a gallery album
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
        { error: 'Album ID is required' },
        { status: 400 }
      );
    }

    // Delete album (cascade will delete all images)
    const result = await pool.query(
      `DELETE FROM gallery_albums WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Gallery album not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Gallery album deleted successfully', deletedId: id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete gallery album error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting gallery album', details: error.message },
      { status: 500 }
    );
  }
}

