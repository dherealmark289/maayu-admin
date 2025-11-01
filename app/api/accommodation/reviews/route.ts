import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

// GET - Fetch all reviews for an accommodation
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
    const accommodationId = searchParams.get('accommodationId');

    let query = 'SELECT * FROM accommodation_reviews';
    const params: any[] = [];

    if (accommodationId) {
      query += ' WHERE "accommodationId" = $1';
      params.push(accommodationId);
    }

    query += ' ORDER BY "createdAt" DESC';

    const result = await pool.query(query, params);

    return NextResponse.json(
      {
        reviews: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get reviews error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching reviews', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new review
export async function POST(request: NextRequest) {
  try {
    // Reviews don't require authentication (public)
    const body = await request.json();
    const { accommodationId, reviewerName, reviewerEmail, rating, comment, imageUrls } = body;

    if (!accommodationId || !reviewerName) {
      return NextResponse.json(
        { error: 'Accommodation ID and reviewer name are required' },
        { status: 400 }
      );
    }

    // Generate UUID
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const reviewId = idResult.rows[0].id;

    const result = await pool.query(`
      INSERT INTO accommodation_reviews (
        id, "accommodationId", "reviewerName", "reviewerEmail", rating, comment, "imageUrls",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      reviewId,
      accommodationId,
      reviewerName,
      reviewerEmail || null,
      rating ? Math.max(1, Math.min(5, parseInt(rating))) : null,
      comment || null,
      imageUrls ? JSON.stringify(imageUrls) : JSON.stringify([])
    ]);

    return NextResponse.json(
      {
        message: 'Review created successfully',
        review: result.rows[0]
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create review error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating review', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a review
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
    const { id, reviewerName, reviewerEmail, rating, comment, imageUrls } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(`
      UPDATE accommodation_reviews
      SET 
        "reviewerName" = COALESCE($1, "reviewerName"),
        "reviewerEmail" = $2,
        rating = $3,
        comment = $4,
        "imageUrls" = $5,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      reviewerName,
      reviewerEmail || null,
      rating ? Math.max(1, Math.min(5, parseInt(rating))) : null,
      comment || null,
      imageUrls ? JSON.stringify(imageUrls) : null,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Review updated successfully',
        review: result.rows[0]
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update review error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating review', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a review
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
      `DELETE FROM accommodation_reviews WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Review deleted successfully',
        deletedId: id
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete review error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting review', details: error.message },
      { status: 500 }
    );
  }
}

