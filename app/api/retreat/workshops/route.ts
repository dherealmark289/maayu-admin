import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// GET - Fetch all workshops (public or admin)
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const isAdmin = token && verifyToken(token);

    // Ensure imageUrls column exists
    try {
      await pool.query('ALTER TABLE retreat_workshops ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[]');
    } catch (e: any) {
      // Column might already exist, ignore error
    }

    // If admin, return all workshops; otherwise, return only published ones
    const whereClause = isAdmin ? '' : 'WHERE published = true';
    const query = `
      SELECT 
        id,
        title,
        dates,
        location,
        overview,
        tagline,
        objectives,
        program,
        "dailyRhythm",
        accommodation,
        meals,
        "volunteerPathway",
        facilitators,
        story,
        "imageUrls",
        published,
        "order",
        "createdAt",
        "updatedAt"
      FROM retreat_workshops
      ${whereClause}
      ORDER BY "order" ASC, "createdAt" DESC
    `;

    const result = await pool.query(query);
    
    const workshops = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      dates: row.dates,
      location: row.location,
      overview: row.overview,
      tagline: row.tagline,
      objectives: Array.isArray(row.objectives) ? row.objectives : [],
      program: row.program ? (typeof row.program === 'string' ? JSON.parse(row.program) : row.program) : [],
      dailyRhythm: row.dailyRhythm,
      accommodation: Array.isArray(row.accommodation) ? row.accommodation : [],
      meals: row.meals,
      volunteerPathway: row.volunteerPathway,
      facilitators: Array.isArray(row.facilitators) ? row.facilitators : [],
      story: row.story,
      imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls : [],
      published: row.published,
      order: row.order,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({ workshops });
  } catch (error: any) {
    console.error('Error fetching retreat workshops:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch retreat workshops' },
      { status: 500 }
    );
  }
}

// POST - Create new workshop (admin only)
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
      dates,
      location,
      overview,
      tagline,
      objectives,
      program,
      dailyRhythm,
      accommodation,
      meals,
      volunteerPathway,
      facilitators,
      story,
      imageUrls,
      published = false,
      order = 0,
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

      // Add imageUrls column if it doesn't exist
      try {
        await pool.query('ALTER TABLE retreat_workshops ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[]');
      } catch (e: any) {}

      const result = await pool.query(
      `
      INSERT INTO retreat_workshops (
        id, title, dates, location, overview, tagline, objectives, program,
        "dailyRhythm", accommodation, meals, "volunteerPathway", facilitators,
        story, "imageUrls", published, "order", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::text[], $7::jsonb,
        $8, $9::text[], $10, $11, $12::text[], $13, $14::text[], $15, $16, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        title,
        dates || null,
        location || null,
        overview || null,
        tagline || null,
        objectives || [],
        program ? JSON.stringify(program) : null,
        dailyRhythm || null,
        accommodation || [],
        meals || null,
        volunteerPathway || null,
        facilitators || [],
        story || null,
        body.imageUrls || [],
        published,
        order,
      ]
    );

    const workshop = result.rows[0];
    return NextResponse.json({ workshop });
  } catch (error: any) {
    console.error('Error creating retreat workshop:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create retreat workshop' },
      { status: 500 }
    );
  }
}

// PUT - Update workshop (admin only)
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
      dates,
      location,
      overview,
      tagline,
      objectives,
      program,
      dailyRhythm,
      accommodation,
      meals,
      volunteerPathway,
      facilitators,
      story,
      imageUrls,
      published,
      order,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

      // Add imageUrls column if it doesn't exist
      try {
        await pool.query('ALTER TABLE retreat_workshops ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[]');
      } catch (e: any) {}

    const result = await pool.query(
      `
      UPDATE retreat_workshops
      SET
        title = $1,
        dates = $2,
        location = $3,
        overview = $4,
        tagline = $5,
        objectives = $6::text[],
        program = $7::jsonb,
        "dailyRhythm" = $8,
        accommodation = $9::text[],
        meals = $10,
        "volunteerPathway" = $11,
        facilitators = $12::text[],
        story = $13,
        "imageUrls" = COALESCE($14::text[], "imageUrls"),
        published = COALESCE($15, published),
        "order" = COALESCE($16, "order"),
        "updatedAt" = NOW()
      WHERE id = $17
      RETURNING *
      `,
      [
        title,
        dates || null,
        location || null,
        overview || null,
        tagline || null,
        objectives || [],
        program ? JSON.stringify(program) : null,
        dailyRhythm || null,
        accommodation || [],
        meals || null,
        volunteerPathway || null,
        facilitators || [],
        story || null,
        imageUrls !== undefined ? imageUrls : null,
        published !== undefined ? published : null,
        order !== undefined ? order : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    const workshop = result.rows[0];
    return NextResponse.json({ workshop });
  } catch (error: any) {
    console.error('Error updating retreat workshop:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update retreat workshop' },
      { status: 500 }
    );
  }
}

// DELETE - Delete workshop (admin only)
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
      'DELETE FROM retreat_workshops WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting retreat workshop:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete retreat workshop' },
      { status: 500 }
    );
  }
}
