import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { uploadToS3, deleteFromS3 } from '@/lib/s3';

// GET - Fetch all accommodations
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

    // Create accommodation_reviews table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accommodation_reviews (
        id VARCHAR(255) PRIMARY KEY,
        "accommodationId" VARCHAR(255) NOT NULL,
        "reviewerName" VARCHAR(255) NOT NULL,
        "reviewerEmail" VARCHAR(255),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        "imageUrls" TEXT[],
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("accommodationId") REFERENCES accommodations(id) ON DELETE CASCADE
      )
    `);

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accommodations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "hostedBy" VARCHAR(255),
        "coHost" VARCHAR(255),
        description TEXT,
        type VARCHAR(255),
        zone VARCHAR(255),
        price DECIMAL(10, 2),
        capacity INTEGER,
        "whatOffers" JSONB,
        amenities TEXT[],
        "imageUrls" TEXT[],
        "houseRules" TEXT,
        location TEXT,
        safety TEXT,
        url VARCHAR(500),
        available BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await pool.query(`
      SELECT * FROM accommodations 
      ORDER BY "createdAt" DESC
    `);

    return NextResponse.json(
      {
        accommodations: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get accommodations error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching accommodations', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new accommodation
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

    // Create table if it doesn't exist first
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accommodations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "hostedBy" VARCHAR(255),
        "coHost" VARCHAR(255),
        description TEXT,
        type VARCHAR(255),
        zone VARCHAR(255),
        price DECIMAL(10, 2),
        capacity INTEGER,
        "whatOffers" JSONB,
        amenities TEXT[],
        "imageUrls" TEXT[],
        "houseRules" TEXT,
        location TEXT,
        safety TEXT,
        url VARCHAR(500),
        available BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Try to add missing columns if table already exists
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS "hostedBy" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS "coHost" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS zone VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS "whatOffers" JSONB');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS "houseRules" TEXT');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS location TEXT');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS safety TEXT');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS url VARCHAR(500)');
    } catch (e: any) {}

    // If title column exists but name doesn't, migrate data
    try {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'accommodations' 
        AND column_name IN ('title', 'name')
      `);
      const columns = checkResult.rows.map(r => r.column_name);
      if (columns.includes('title') && !columns.includes('name')) {
        await pool.query('ALTER TABLE accommodations ADD COLUMN name VARCHAR(255)');
        await pool.query('UPDATE accommodations SET name = title WHERE name IS NULL');
      }
    } catch (e: any) {
      console.log('Migration check skipped:', e.message);
    }

    const body = await request.json();
    const { 
      name, hostedBy, coHost, description, type, zone, price, capacity, 
      whatOffers, amenities, imageUrls, houseRules, location, 
      safety, url, available 
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Property name is required' },
        { status: 400 }
      );
    }

    // Generate UUID
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const accommodationId = idResult.rows[0].id;

    // Handle arrays properly - PostgreSQL expects arrays or JSON strings
    const amenitiesArray = amenities && Array.isArray(amenities) ? amenities : (amenities ? JSON.parse(JSON.stringify(amenities)) : []);
    const imageUrlsArray = imageUrls && Array.isArray(imageUrls) ? imageUrls : (imageUrls ? JSON.parse(JSON.stringify(imageUrls)) : []);

    const result = await pool.query(`
      INSERT INTO accommodations (
        id, name, "hostedBy", "coHost", description, type, zone, price, capacity,
        "whatOffers", amenities, "imageUrls", "houseRules", location, safety, url, available,
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      accommodationId,
      name,
      hostedBy || null,
      coHost || null,
      description || null,
      type || null,
      zone || null,
      price || null,
      capacity || null,
      whatOffers ? (typeof whatOffers === 'string' ? whatOffers : JSON.stringify(whatOffers)) : null,
      amenitiesArray.length > 0 ? amenitiesArray : null,
      imageUrlsArray.length > 0 ? imageUrlsArray : null,
      houseRules || null,
      location || null,
      safety || null,
      url || null,
      available !== undefined ? available : true
    ]);

    const accommodation = result.rows[0];

    // Link uploaded images to this accommodation after creation
    if (imageUrls && imageUrls.length > 0) {
      try {
        // Add accommodationId column if it doesn't exist
        try {
          await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "accommodationId" VARCHAR(255)');
        } catch (e: any) {}

        // Update media records with accommodationId by matching URLs
        for (const url of imageUrls) {
          await pool.query(
            `UPDATE media SET "accommodationId" = $1 WHERE url = $2 AND category = 'accommodation' AND "accommodationId" IS NULL`,
            [accommodationId, url]
          );
        }
      } catch (updateError) {
        console.error('Error linking images to accommodation:', updateError);
        // Continue even if linking fails
      }
    }

    return NextResponse.json(
      {
        message: 'Accommodation created successfully',
        accommodation: result.rows[0]
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create accommodation error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    });
    return NextResponse.json(
      { 
        error: 'An error occurred while creating accommodation', 
        details: error.message,
        code: error.code,
        constraint: error.constraint,
      },
      { status: 500 }
    );
  }
}

// PUT - Update an accommodation
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
    const { 
      id, name, hostedBy, coHost, description, type, zone, price, capacity,
      whatOffers, amenities, imageUrls, houseRules, location, safety, url, available 
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // Handle arrays properly
    const amenitiesArray = amenities && Array.isArray(amenities) ? amenities : (amenities ? JSON.parse(JSON.stringify(amenities)) : []);
    const imageUrlsArray = imageUrls && Array.isArray(imageUrls) ? imageUrls : (imageUrls ? JSON.parse(JSON.stringify(imageUrls)) : []);

    const result = await pool.query(`
      UPDATE accommodations
      SET 
        name = COALESCE($1, name),
        "hostedBy" = $2,
        "coHost" = $3,
        description = $4,
        type = $5,
        zone = $6,
        price = $7,
        capacity = $8,
        "whatOffers" = $9,
        amenities = $10,
        "imageUrls" = $11,
        "houseRules" = $12,
        location = $13,
        safety = $14,
        url = $15,
        available = COALESCE($16, available),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `, [
      name,
      hostedBy || null,
      coHost || null,
      description || null,
      type || null,
      zone || null,
      price || null,
      capacity || null,
      whatOffers ? JSON.stringify(whatOffers) : null,
      amenitiesArray.length > 0 ? amenitiesArray : null,
      imageUrlsArray.length > 0 ? imageUrlsArray : null,
      houseRules || null,
      location || null,
      safety || null,
      url || null,
      available,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Accommodation not found' },
        { status: 404 }
      );
    }

    const accommodation = result.rows[0];

    // Update image links - ensure all images in imageUrls are linked to this accommodation
    if (imageUrlsArray && imageUrlsArray.length > 0) {
      try {
        // Add accommodationId column if it doesn't exist
        try {
          await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "accommodationId" VARCHAR(255)');
        } catch (e: any) {}

        // Update media records with accommodationId by matching URLs
        for (const url of imageUrlsArray) {
          await pool.query(
            `UPDATE media SET "accommodationId" = $1 WHERE url = $2 AND category = 'accommodation'`,
            [id, url]
          );
        }

        // Unlink images that are no longer in the imageUrls array
        const currentUrls = imageUrlsArray.map((url: string) => url.toLowerCase());
        await pool.query(
          `UPDATE media SET "accommodationId" = NULL WHERE "accommodationId" = $1 AND category = 'accommodation' AND LOWER(url) != ALL($2::text[])`,
          [id, currentUrls]
        );
      } catch (updateError) {
        console.error('Error linking images to accommodation:', updateError);
        // Continue even if linking fails
      }
    }

    return NextResponse.json(
      {
        message: 'Accommodation updated successfully',
        accommodation: result.rows[0]
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update accommodation error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating accommodation', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete an accommodation
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
      `DELETE FROM accommodations WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Accommodation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Accommodation deleted successfully',
        deletedId: id
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete accommodation error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting accommodation', details: error.message },
      { status: 500 }
    );
  }
}


