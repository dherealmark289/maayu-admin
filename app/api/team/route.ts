import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// GET - Fetch all team members
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

    // Create table if it doesn't exist (MUST be first for foreign keys)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        bio TEXT,
        "group" VARCHAR(255),
        "photoUrl" TEXT,
        "order" INTEGER DEFAULT 0,
        "socialLinks" JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create skills table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create team_member_skills join table if it doesn't exist (must be last due to foreign keys)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS team_member_skills (
          id VARCHAR(255) PRIMARY KEY,
          "teamMemberId" VARCHAR(255) NOT NULL,
          "skillId" VARCHAR(255) NOT NULL,
          level INTEGER NOT NULL CHECK (level >= 1 AND level <= 10),
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("teamMemberId", "skillId")
        )
      `);

      // Add foreign keys separately (might fail if they already exist, that's fine)
      try {
        await pool.query(`
          ALTER TABLE team_member_skills
          ADD CONSTRAINT fk_team_member 
          FOREIGN KEY ("teamMemberId") REFERENCES team_members(id) ON DELETE CASCADE
        `);
      } catch (e: any) {
        // Foreign key might already exist, ignore
      }

      try {
        await pool.query(`
          ALTER TABLE team_member_skills
          ADD CONSTRAINT fk_skill 
          FOREIGN KEY ("skillId") REFERENCES skills(id) ON DELETE CASCADE
        `);
      } catch (e: any) {
        // Foreign key might already exist, ignore
      }
    } catch (error: any) {
      // Table might already exist, ignore
      console.log('team_member_skills table creation:', error.message);
    }
    
    // Ensure timestamps have defaults
    try {
      await pool.query(`
        ALTER TABLE team_members 
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
      `);
    } catch (error: any) {
      // Ignore if columns already have defaults
    }

    const result = await pool.query(`
      SELECT 
        tm.*,
        COALESCE(
          json_agg(
            json_build_object(
              'skill', json_build_object('id', s.id, 'name', s.name),
              'level', tms.level
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) as skills
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms."teamMemberId"
      LEFT JOIN skills s ON tms."skillId" = s.id
      GROUP BY tm.id
      ORDER BY tm."order" ASC, tm."createdAt" DESC
    `);

    return NextResponse.json(
      {
        teamMembers: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get team members error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching team members', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new team member
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
    const { name, role, bio, group, photoUrl, order, socialLinks, skills } = body;

    if (!name || !role) {
      return NextResponse.json(
        { error: 'Name and role are required' },
        { status: 400 }
      );
    }

    // Generate UUID for the team member
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const teamMemberId = idResult.rows[0].id;

    const result = await pool.query(`
      INSERT INTO team_members (id, name, role, bio, "group", "photoUrl", "order", "socialLinks", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      teamMemberId,
      name,
      role,
      bio || null,
      group || null,
      photoUrl || null,
      order || 0,
      socialLinks ? JSON.stringify(socialLinks) : null
    ]);

    // Handle skills - create skills if they don't exist and link them
    if (skills && Array.isArray(skills) && skills.length > 0) {
      for (const skillData of skills) {
        const skillName = skillData.skillName || skillData.name;
        const level = Math.max(1, Math.min(10, parseInt(skillData.level) || 5)); // Clamp between 1-10

        // Check if skill exists, if not create it
        let skillResult = await pool.query(
          'SELECT id FROM skills WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [skillName]
        );

        let skillId: string;
        if (skillResult.rows.length === 0) {
          // Create skill
          const skillIdResult = await pool.query('SELECT gen_random_uuid()::text as id');
          skillId = skillIdResult.rows[0].id;
          await pool.query(
            'INSERT INTO skills (id, name, "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [skillId, skillName]
          );
        } else {
          skillId = skillResult.rows[0].id;
        }

        // Link skill to team member
        const linkIdResult = await pool.query('SELECT gen_random_uuid()::text as id');
        await pool.query(
          `INSERT INTO team_member_skills (id, "teamMemberId", "skillId", level, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT ("teamMemberId", "skillId") DO UPDATE SET level = $4, "updatedAt" = CURRENT_TIMESTAMP`,
          [linkIdResult.rows[0].id, teamMemberId, skillId, level]
        );
      }
    }

            // Link photo to team member if photoUrl is provided
            if (photoUrl) {
              try {
                // Add teamMemberId column if it doesn't exist
                try {
                  await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "teamMemberId" VARCHAR(255)');
                } catch (e: any) {}

                // Update media record with teamMemberId by matching URL
                await pool.query(
                  `UPDATE media SET "teamMemberId" = $1 WHERE url = $2 AND category = 'team' AND "teamMemberId" IS NULL`,
                  [teamMemberId, photoUrl]
                );
              } catch (updateError) {
                console.error('Error linking photo to team member:', updateError);
                // Continue even if linking fails
              }
            }

            // Fetch the created team member with skills
            const memberWithSkills = await pool.query(`
              SELECT 
                tm.*,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'skill', json_build_object('id', s.id, 'name', s.name),
                      'level', tms.level
                    )
                  ) FILTER (WHERE s.id IS NOT NULL),
                  '[]'::json
                ) as skills
              FROM team_members tm
              LEFT JOIN team_member_skills tms ON tm.id = tms."teamMemberId"
              LEFT JOIN skills s ON tms."skillId" = s.id
              WHERE tm.id = $1
              GROUP BY tm.id
            `, [teamMemberId]);

            return NextResponse.json(
              {
                message: 'Team member created successfully',
                teamMember: memberWithSkills.rows[0]
              },
              { status: 201 }
            );
  } catch (error: any) {
    console.error('Create team member error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'An error occurred while creating team member',
        details: error.message,
        ...(error.code && { code: error.code })
      },
      { status: 500 }
    );
  }
}

// PUT - Update a team member
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
    const { id, name, role, bio, group, photoUrl, order, socialLinks, skills } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(`
      UPDATE team_members
      SET 
        name = COALESCE($1, name),
        role = COALESCE($2, role),
        bio = $3,
        "group" = $4,
        "photoUrl" = $5,
        "order" = COALESCE($6, "order"),
        "socialLinks" = $7,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [name, role, bio || null, group || null, photoUrl || null, order, socialLinks ? JSON.stringify(socialLinks) : null, id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Update skills - remove existing skills for this member
    await pool.query('DELETE FROM team_member_skills WHERE "teamMemberId" = $1', [id]);

    // Add new skills
    if (skills && Array.isArray(skills) && skills.length > 0) {
      for (const skillData of skills) {
        const skillName = skillData.skillName || skillData.name;
        const level = Math.max(1, Math.min(10, parseInt(skillData.level) || 5));

        // Check if skill exists, if not create it
        let skillResult = await pool.query(
          'SELECT id FROM skills WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [skillName]
        );

        let skillId: string;
        if (skillResult.rows.length === 0) {
          const skillIdResult = await pool.query('SELECT gen_random_uuid()::text as id');
          skillId = skillIdResult.rows[0].id;
          await pool.query(
            'INSERT INTO skills (id, name, "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [skillId, skillName]
          );
        } else {
          skillId = skillResult.rows[0].id;
        }

        // Link skill to team member
        const linkIdResult = await pool.query('SELECT gen_random_uuid()::text as id');
        await pool.query(
          `INSERT INTO team_member_skills (id, "teamMemberId", "skillId", level, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [linkIdResult.rows[0].id, id, skillId, level]
        );
      }
    }

            // Link/update photo link to team member
            if (photoUrl) {
              try {
                // Add teamMemberId column if it doesn't exist
                try {
                  await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "teamMemberId" VARCHAR(255)');
                } catch (e: any) {}

                // Update media record with teamMemberId by matching URL
                await pool.query(
                  `UPDATE media SET "teamMemberId" = $1 WHERE url = $2 AND category = 'team'`,
                  [id, photoUrl]
                );

                // Unlink old photo if photoUrl changed
                const oldMember = await pool.query('SELECT "photoUrl" FROM team_members WHERE id = $1', [id]);
                if (oldMember.rows.length > 0 && oldMember.rows[0].photoUrl && oldMember.rows[0].photoUrl !== photoUrl) {
                  await pool.query(
                    `UPDATE media SET "teamMemberId" = NULL WHERE url = $1 AND category = 'team'`,
                    [oldMember.rows[0].photoUrl]
                  );
                }
              } catch (updateError) {
                console.error('Error linking photo to team member:', updateError);
                // Continue even if linking fails
              }
            }

            // Fetch updated team member with skills
            const memberWithSkills = await pool.query(`
              SELECT 
                tm.*,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'skill', json_build_object('id', s.id, 'name', s.name),
                      'level', tms.level
                    )
                  ) FILTER (WHERE s.id IS NOT NULL),
                  '[]'::json
                ) as skills
              FROM team_members tm
              LEFT JOIN team_member_skills tms ON tm.id = tms."teamMemberId"
              LEFT JOIN skills s ON tms."skillId" = s.id
              WHERE tm.id = $1
              GROUP BY tm.id
            `, [id]);

            return NextResponse.json(
              {
                message: 'Team member updated successfully',
                teamMember: memberWithSkills.rows[0]
              },
              { status: 200 }
            );
  } catch (error: any) {
    console.error('Update team member error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating team member', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a team member
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
      `DELETE FROM team_members WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Team member deleted successfully',
        deletedId: id
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete team member error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting team member', details: error.message },
      { status: 500 }
    );
  }
}


