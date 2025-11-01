import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// GET - Fetch vision content
export async function GET(request: NextRequest) {
  try {
    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vision_content (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT,
        description TEXT,
        "buttonText" TEXT DEFAULT 'Explore Our World Map',
        "introText1" TEXT,
        "introText2" TEXT,
        zones JSONB,
        "ecosystemImageUrl" TEXT,
        "ecosystemText1" TEXT,
        "ecosystemText2" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns if they don't exist
    try {
      await pool.query(`ALTER TABLE vision_content ADD COLUMN IF NOT EXISTS title TEXT`);
      await pool.query(`ALTER TABLE vision_content ADD COLUMN IF NOT EXISTS description TEXT`);
      await pool.query(`ALTER TABLE vision_content ADD COLUMN IF NOT EXISTS "buttonText" TEXT DEFAULT 'Explore Our World Map'`);
    } catch (error: any) {
      // Ignore if columns already exist
    }

    // Ensure timestamps have defaults
    try {
      await pool.query(`
        ALTER TABLE vision_content 
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
      `);
    } catch (error: any) {
      // Ignore if columns already have defaults
    }

    // Fetch vision content (get first record or create default)
    const result = await pool.query(`
      SELECT * FROM vision_content
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      // Return default structure
      return NextResponse.json({
        visionContent: {
          id: null,
          title: 'Building Our Own World',
          description: 'Not an all-inclusive resort -but an ecosystem for growth, creation, and connection, A world we\'re building for ourselves and for anyone ready to live fully – in rhythm with nature.',
          buttonText: 'Explore Our World Map',
          introText1: 'Mayu.Farm becomes part of something larger — a self-sustaining, living world built in rhythm with nature.',
          introText2: "It's a world made up of three interconnected zones:",
          zones: [
            {
              name: 'dao-home',
              title: 'DAO HOME — Our Heart & Home',
              description: [
                'Where it all began — a handful of huts, a turtle pond, and an idea: to live simply, grow slowly, and share what we learn.',
                'Here, volunteers and travelers live together, tending the land, sharing meals, and dreaming under the same roof.'
              ],
              tags: ['#FarmStay', '#Community', '#Animals', '#SimpleLiving'],
              imageUrl: ''
            },
            {
              name: 'lilac',
              title: 'LILAC — Move, Breathe, Build Strength',
              description: [
                'Our gym and accommodation zone — built from bamboo and mountain air.',
                'This is where movement meets mindfulness: ice baths, mobility practice, community workouts.',
                'A place for body transformation and quiet reflection.'
              ],
              tags: ['#Strength', '#Wellness', '#Recovery', '#Discipline'],
              imageUrl: ''
            },
            {
              name: 'mayu',
              title: 'MAYU — The Learning Center',
              description: [
                'The heart of our knowledge ecosystem — where retreats, coffee roasting, and workshops happen.',
                'Here we study soil, structure, and soul, and share everything we discover.'
              ],
              tags: ['#Learning', '#Workshops', '#Retreats', '#CoffeeCulture'],
              imageUrl: ''
            }
          ],
          ecosystemImageUrl: '',
          ecosystemText1: 'Together, these spaces form a living ecosystem — a world meant to evolve, to welcome dreamers, makers, and wanderers alike.',
          ecosystemText2: 'We call it Maayu.Farm — not an all-inclusive resort, but a world in rhythm with nature, a Stardew-Valley-inspired reality where growth, connection, and creativity take root.'
        }
      });
    }

    const visionContent = result.rows[0];
    // Parse zones if they're stored as JSON string
    if (visionContent.zones && typeof visionContent.zones === 'string') {
      visionContent.zones = JSON.parse(visionContent.zones);
    } else if (visionContent.zones && typeof visionContent.zones === 'object') {
      // Already parsed, keep as is
    } else {
      visionContent.zones = [];
    }
    return NextResponse.json({ visionContent });
  } catch (error: any) {
    console.error('Error fetching vision content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vision content', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update vision content
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
      id,
      title,
      description,
      buttonText,
      introText1,
      introText2,
      zones,
      ecosystemImageUrl,
      ecosystemText1,
      ecosystemText2,
    } = body;

    console.log('Vision content update request:', { id, hasZones: !!zones, zonesType: typeof zones });

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vision_content (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT,
        description TEXT,
        "buttonText" TEXT DEFAULT 'Explore Our World Map',
        "introText1" TEXT,
        "introText2" TEXT,
        zones JSONB,
        "ecosystemImageUrl" TEXT,
        "ecosystemText1" TEXT,
        "ecosystemText2" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add new columns if they don't exist
    try {
      await pool.query(`ALTER TABLE vision_content ADD COLUMN IF NOT EXISTS title TEXT`);
      await pool.query(`ALTER TABLE vision_content ADD COLUMN IF NOT EXISTS description TEXT`);
      await pool.query(`ALTER TABLE vision_content ADD COLUMN IF NOT EXISTS "buttonText" TEXT DEFAULT 'Explore Our World Map'`);
    } catch (error: any) {
      // Ignore if columns already exist
    }

    // Prepare zones for database (convert to JSONB)
    let zonesJsonb: string = '[]';
    try {
      if (zones && Array.isArray(zones)) {
        zonesJsonb = JSON.stringify(zones);
      } else if (zones && typeof zones === 'object') {
        zonesJsonb = JSON.stringify(zones);
      }
      
      // Validate JSON is valid
      JSON.parse(zonesJsonb);
    } catch (jsonError) {
      console.error('Error stringifying zones:', jsonError);
      console.error('Zones data:', zones);
      zonesJsonb = '[]';
    }

    // Check if record exists
    let existingRecord = null;
    if (id) {
      const checkResult = await pool.query('SELECT id FROM vision_content WHERE id = $1', [id]);
      existingRecord = checkResult.rows[0];
    } else {
      // Get first record if any exists
      const checkResult = await pool.query('SELECT id FROM vision_content ORDER BY "createdAt" DESC LIMIT 1');
      existingRecord = checkResult.rows[0];
    }

    if (existingRecord) {
      // Update existing record
      const result = await pool.query(`
        UPDATE vision_content
        SET
          title = $1,
          description = $2,
          "buttonText" = $3,
          "introText1" = $4,
          "introText2" = $5,
          zones = $6,
          "ecosystemImageUrl" = $7,
          "ecosystemText1" = $8,
          "ecosystemText2" = $9,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *
      `, [
        title || null,
        description || null,
        buttonText || 'Explore Our World Map',
        introText1 || null,
        introText2 || null,
        zonesJsonb, // JSON string - PostgreSQL will handle JSONB conversion
        ecosystemImageUrl || null,
        ecosystemText1 || null,
        ecosystemText2 || null,
        existingRecord.id
      ]);

      const updatedContent = result.rows[0];
      // Parse zones for response
      if (updatedContent.zones && typeof updatedContent.zones === 'string') {
        try {
          updatedContent.zones = JSON.parse(updatedContent.zones);
        } catch (e) {
          console.error('Error parsing zones:', e);
          updatedContent.zones = [];
        }
      } else if (!updatedContent.zones) {
        updatedContent.zones = [];
      }
      return NextResponse.json({ visionContent: updatedContent });
    } else {
      // Create new record - generate ID first
      const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
      const visionContentId = idResult.rows[0].id;

      const result = await pool.query(`
        INSERT INTO vision_content (
          id, title, description, "buttonText", "introText1", "introText2", zones, "ecosystemImageUrl", "ecosystemText1", "ecosystemText2"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        visionContentId,
        title || null,
        description || null,
        buttonText || 'Explore Our World Map',
        introText1 || null,
        introText2 || null,
        zonesJsonb, // JSON string - PostgreSQL will handle JSONB conversion
        ecosystemImageUrl || null,
        ecosystemText1 || null,
        ecosystemText2 || null
      ]);

      const newContent = result.rows[0];
      // Parse zones for response
      if (newContent.zones && typeof newContent.zones === 'string') {
        try {
          newContent.zones = JSON.parse(newContent.zones);
        } catch (e) {
          console.error('Error parsing zones:', e);
          newContent.zones = [];
        }
      } else if (!newContent.zones) {
        newContent.zones = [];
      }
      return NextResponse.json({ visionContent: newContent });
    }
  } catch (error: any) {
    console.error('Error updating vision content:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    return NextResponse.json(
      { 
        error: 'Failed to update vision content', 
        details: error.message,
        code: error.code,
        detail: error.detail,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

