import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

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

    // First, let's try to find all tables to discover the correct table name
    let tableName = null;
    const possibleTableNames = ['retreats', 'retreat', 'retreat_data', 'retreats_data'];

    // Try to get all table names from the database
    try {
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const existingTables = tablesResult.rows.map((row: any) => row.table_name.toLowerCase());
      
      // Find the retreat table
      for (const name of possibleTableNames) {
        if (existingTables.includes(name.toLowerCase())) {
          tableName = name;
          break;
        }
      }
      
      // If not found in our list, look for tables with 'retreat' in the name
      if (!tableName) {
        const retreatTable = existingTables.find((t: string) => t.includes('retreat'));
        if (retreatTable) {
          tableName = retreatTable;
        }
      }
      
      console.log('Found existing tables:', existingTables);
      console.log('Using table name:', tableName);
    } catch (err) {
      console.log('Could not query table names, trying direct queries...');
    }

    // Try to fetch data from the discovered table or try common names
    let result = null;
    let queryError = null;
    
    if (tableName) {
      try {
        // Try with discovered table name
        result = await pool.query(`
          SELECT * FROM "${tableName}" 
          ORDER BY id DESC
        `);
        console.log(`Fetched ${result.rows.length} records from table: ${tableName}`);
      } catch (err: any) {
        queryError = err.message;
        console.log(`Error querying ${tableName}:`, err.message);
      }
    }
    
    // If not found yet, try common table names directly
    if (!result) {
      for (const name of possibleTableNames) {
        try {
          result = await pool.query(`
            SELECT * FROM "${name}" 
            ORDER BY id DESC
          `);
          tableName = name;
          console.log(`Successfully fetched from ${name}:`, result.rows.length, 'records');
          break;
        } catch (err: any) {
          queryError = err.message;
          console.log(`Table ${name} not found or error:`, err.message);
        }
      }
    }

    // If still no result, try without quotes (in case it's case-sensitive)
    if (!result) {
      for (const name of possibleTableNames) {
        try {
          result = await pool.query(`
            SELECT * FROM ${name} 
            ORDER BY id DESC
          `);
          tableName = name;
          console.log(`Successfully fetched from ${name} (no quotes):`, result.rows.length, 'records');
          break;
        } catch (err: any) {
          queryError = err.message;
        }
      }
    }

    if (!result) {
      // Table doesn't exist, create it
      console.log('Retreat table not found, creating it...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS retreats (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255),
          description TEXT,
          location VARCHAR(255),
          date DATE,
          price DECIMAL(10, 2),
          capacity INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      return NextResponse.json(
        { 
          retreats: [],
          message: 'Retreat table created. No data found.',
          debug: queryError ? `Last error: ${queryError}` : undefined
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        retreats: result.rows || [],
        tableName: tableName,
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get retreats error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching retreats', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Helper function to find the retreat table name
async function findRetreatTable(): Promise<string | null> {
  let tableName = null;
  const possibleTableNames = ['retreats', 'retreat', 'retreat_data', 'retreats_data'];

  try {
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map((row: any) => row.table_name.toLowerCase());
    
    for (const name of possibleTableNames) {
      if (existingTables.includes(name.toLowerCase())) {
        tableName = name;
        break;
      }
    }
    
    if (!tableName) {
      const retreatTable = existingTables.find((t: string) => t.includes('retreat'));
      if (retreatTable) {
        tableName = retreatTable;
      }
    }
  } catch (err) {
    console.log('Could not query table names');
  }

  // If still not found, try direct queries
  if (!tableName) {
    for (const name of possibleTableNames) {
      try {
        await pool.query(`SELECT 1 FROM "${name}" LIMIT 1`);
        tableName = name;
        break;
      } catch (e) {
        // Continue
      }
    }
  }

  return tableName;
}

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
        { error: 'Retreat ID is required' },
        { status: 400 }
      );
    }

    const tableName = await findRetreatTable();

    if (!tableName) {
      return NextResponse.json(
        { error: 'Retreat table not found' },
        { status: 404 }
      );
    }

    // Delete the retreat by ID
    let deleteResult;
    try {
      deleteResult = await pool.query(
        `DELETE FROM "${tableName}" WHERE id = $1 RETURNING id`,
        [id]
      );
    } catch (err: any) {
      // Try without quotes
      deleteResult = await pool.query(
        `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`,
        [id]
      );
    }

    if (deleteResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Retreat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Retreat deleted successfully',
        deletedId: id
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete retreat error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while deleting the retreat', 
        details: error.message
      },
      { status: 500 }
    );
  }
}

