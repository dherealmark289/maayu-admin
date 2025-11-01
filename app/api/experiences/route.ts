import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// GET - Fetch all experiences (public or admin)
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const isAdmin = token && verifyToken(token);

    // Ensure experiences table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS experiences (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          title TEXT NOT NULL,
          subtitle TEXT,
          category TEXT,
          duration TEXT,
          "priceTHB" INTEGER,
          difficulty TEXT,
          capacity TEXT,
          schedule TEXT,
          includes TEXT[],
          bring TEXT[],
          image TEXT,
          "imageUrls" TEXT[],
          cta TEXT,
          link TEXT,
          badge TEXT,
          published BOOLEAN DEFAULT false,
          "order" INTEGER DEFAULT 0,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (e: any) {
      // Table might already exist, ignore error
    }

    // Ensure imageUrls column exists
    try {
      await pool.query('ALTER TABLE experiences ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[]');
    } catch (e: any) {
      // Column might already exist, ignore error
    }

    // If admin, return all experiences; otherwise, return only published ones
    const whereClause = isAdmin ? '' : 'WHERE published = true';
    const query = `
      SELECT 
        id,
        title,
        subtitle,
        category,
        duration,
        "priceTHB",
        difficulty,
        capacity,
        schedule,
        includes,
        bring,
        image,
        "imageUrls",
        cta,
        link,
        badge,
        published,
        "order",
        "createdAt",
        "updatedAt"
      FROM experiences
      ${whereClause}
      ORDER BY "order" ASC, "createdAt" DESC
    `;

    const result = await pool.query(query);
    
    const experiences = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      category: row.category,
      duration: row.duration,
      priceTHB: row.priceTHB,
      difficulty: row.difficulty,
      capacity: row.capacity,
      schedule: row.schedule,
      includes: Array.isArray(row.includes) ? row.includes : [],
      bring: Array.isArray(row.bring) ? row.bring : [],
      image: row.image,
      imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls : [],
      cta: row.cta,
      link: row.link,
      badge: row.badge,
      published: row.published,
      order: row.order,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ experiences });
  } catch (error: any) {
    console.error('Error fetching experiences:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch experiences' },
      { status: 500 }
    );
  }
}

// POST - Create new experience (admin only)
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      subtitle,
      category,
      duration,
      priceTHB,
      difficulty,
      capacity,
      schedule,
      includes,
      bring,
      image,
      imageUrls,
      cta,
      link,
      badge,
      published = false,
      order = 0,
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Ensure experiences table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS experiences (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          title TEXT NOT NULL,
          subtitle TEXT,
          category TEXT,
          duration TEXT,
          "priceTHB" INTEGER,
          difficulty TEXT,
          capacity TEXT,
          schedule TEXT,
          includes TEXT[],
          bring TEXT[],
          image TEXT,
          "imageUrls" TEXT[],
          cta TEXT,
          link TEXT,
          badge TEXT,
          published BOOLEAN DEFAULT false,
          "order" INTEGER DEFAULT 0,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (e: any) {}

    // Ensure imageUrls column exists
    try {
      await pool.query('ALTER TABLE experiences ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[]');
    } catch (e: any) {}

    const result = await pool.query(
      `
      INSERT INTO experiences (
        id, title, subtitle, category, duration, "priceTHB", difficulty, capacity,
        schedule, includes, bring, image, "imageUrls", cta, link, badge,
        published, "order", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::text[],
        $11, $12::text[], $13, $14, $15, $16, $17, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        title,
        subtitle || null,
        category || null,
        duration || null,
        priceTHB !== undefined ? priceTHB : null,
        difficulty || null,
        capacity || null,
        schedule || null,
        includes || [],
        bring || [],
        image || null,
        imageUrls || [],
        cta || null,
        link || null,
        badge || null,
        published,
        order,
      ]
    );

    const experience = result.rows[0];
    return NextResponse.json({ experience });
  } catch (error: any) {
    console.error('Error creating experience:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create experience' },
      { status: 500 }
    );
  }
}

// PUT - Update experience (admin only)
export async function PUT(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      title,
      subtitle,
      category,
      duration,
      priceTHB,
      difficulty,
      capacity,
      schedule,
      includes,
      bring,
      image,
      imageUrls,
      cta,
      link,
      badge,
      published,
      order,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Ensure imageUrls column exists
    try {
      await pool.query('ALTER TABLE experiences ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[]');
    } catch (e: any) {}

    const result = await pool.query(
      `
      UPDATE experiences
      SET
        title = $1,
        subtitle = COALESCE($2, subtitle),
        category = COALESCE($3, category),
        duration = COALESCE($4, duration),
        "priceTHB" = COALESCE($5, "priceTHB"),
        difficulty = COALESCE($6, difficulty),
        capacity = COALESCE($7, capacity),
        schedule = COALESCE($8, schedule),
        includes = COALESCE($9::text[], includes),
        bring = COALESCE($10::text[], bring),
        image = COALESCE($11, image),
        "imageUrls" = COALESCE($12::text[], "imageUrls"),
        cta = COALESCE($13, cta),
        link = COALESCE($14, link),
        badge = COALESCE($15, badge),
        published = COALESCE($16, published),
        "order" = COALESCE($17, "order"),
        "updatedAt" = NOW()
      WHERE id = $18
      RETURNING *
      `,
      [
        title,
        subtitle !== undefined ? subtitle : null,
        category !== undefined ? category : null,
        duration !== undefined ? duration : null,
        priceTHB !== undefined ? priceTHB : null,
        difficulty !== undefined ? difficulty : null,
        capacity !== undefined ? capacity : null,
        schedule !== undefined ? schedule : null,
        includes !== undefined ? includes : [],
        bring !== undefined ? bring : [],
        image !== undefined ? image : null,
        imageUrls !== undefined ? imageUrls : null,
        cta !== undefined ? cta : null,
        link !== undefined ? link : null,
        badge !== undefined ? badge : null,
        published !== undefined ? published : null,
        order !== undefined ? order : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const experience = result.rows[0];
    return NextResponse.json({ experience });
  } catch (error: any) {
    console.error('Error updating experience:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update experience' },
      { status: 500 }
    );
  }
}

// DELETE - Delete experience (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const result = await pool.query(
      'DELETE FROM experiences WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting experience:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete experience' },
      { status: 500 }
    );
  }
}


