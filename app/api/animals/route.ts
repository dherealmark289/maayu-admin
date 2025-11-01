import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// GET - Fetch all animals
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

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS animals (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        species VARCHAR(255),
        breed VARCHAR(255),
        bio TEXT,
        status VARCHAR(255) DEFAULT 'available',
        "photoUrls" TEXT[],
        "healthInfo" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Ensure timestamps have defaults
    try {
      await pool.query(`
        ALTER TABLE animals 
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
      `);
    } catch (error: any) {
      // Ignore if columns already have defaults
    }

    const result = await pool.query(`
      SELECT * FROM animals 
      ORDER BY "createdAt" DESC
    `);

    return NextResponse.json(
      {
        animals: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get animals error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching animals', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new animal
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
    const { name, species, breed, bio, status, photoUrls, healthInfo } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate UUID
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const animalId = idResult.rows[0].id;

    // Handle arrays properly - PostgreSQL expects arrays or JSON strings
    const photoUrlsArray = photoUrls && Array.isArray(photoUrls) ? photoUrls : (photoUrls ? JSON.parse(JSON.stringify(photoUrls)) : []);

    const result = await pool.query(`
      INSERT INTO animals (id, name, species, breed, bio, status, "photoUrls", "healthInfo", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      animalId,
      name,
      species || null,
      breed || null,
      bio || null,
      status || 'available',
      photoUrlsArray.length > 0 ? photoUrlsArray : null,
      healthInfo || null
    ]);

    const animal = result.rows[0];

    // Link uploaded images to this animal after creation
    if (photoUrls && photoUrls.length > 0) {
      try {
        // Add animalId column if it doesn't exist
        try {
          await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "animalId" VARCHAR(255)');
        } catch (e: any) {}

        // Update media records with animalId by matching URLs
        for (const url of photoUrls) {
          await pool.query(
            `UPDATE media SET "animalId" = $1 WHERE url = $2 AND category = 'animals' AND "animalId" IS NULL`,
            [animalId, url]
          );
        }
      } catch (updateError) {
        console.error('Error linking images to animal:', updateError);
        // Continue even if linking fails
      }
    }

    return NextResponse.json(
      {
        message: 'Animal created successfully',
        animal: result.rows[0]
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create animal error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating animal', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update an animal
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
    const { id, name, species, breed, bio, status, photoUrls, healthInfo } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // Handle arrays properly
    const photoUrlsArray = photoUrls && Array.isArray(photoUrls) ? photoUrls : (photoUrls ? JSON.parse(JSON.stringify(photoUrls)) : []);

    const result = await pool.query(`
      UPDATE animals
      SET 
        name = COALESCE($1, name),
        species = $2,
        breed = $3,
        bio = $4,
        status = COALESCE($5, status),
        "photoUrls" = $6,
        "healthInfo" = $7,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      name,
      species || null,
      breed || null,
      bio || null,
      status,
      photoUrlsArray.length > 0 ? photoUrlsArray : null,
      healthInfo || null,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Animal not found' },
        { status: 404 }
      );
    }

    const animal = result.rows[0];

    // Update image links - ensure all images in photoUrls are linked to this animal
    if (photoUrlsArray && photoUrlsArray.length > 0) {
      try {
        // Add animalId column if it doesn't exist
        try {
          await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "animalId" VARCHAR(255)');
        } catch (e: any) {}

        // Update media records with animalId by matching URLs
        for (const url of photoUrlsArray) {
          await pool.query(
            `UPDATE media SET "animalId" = $1 WHERE url = $2 AND category = 'animals'`,
            [id, url]
          );
        }

        // Unlink images that are no longer in the photoUrls array
        const currentUrls = photoUrlsArray.map((url: string) => url.toLowerCase());
        await pool.query(
          `UPDATE media SET "animalId" = NULL WHERE "animalId" = $1 AND category = 'animals' AND LOWER(url) != ALL($2::text[])`,
          [id, currentUrls]
        );
      } catch (updateError) {
        console.error('Error linking images to animal:', updateError);
        // Continue even if linking fails
      }
    }

    return NextResponse.json(
      {
        message: 'Animal updated successfully',
        animal: result.rows[0]
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update animal error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating animal', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete an animal
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
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `DELETE FROM animals WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Animal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Animal deleted successfully',
        deletedId: id
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete animal error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting animal', details: error.message },
      { status: 500 }
    );
  }
}


