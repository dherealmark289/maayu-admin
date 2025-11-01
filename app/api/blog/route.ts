import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import pool from '@/lib/db';

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// GET - Fetch all blog posts
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    // Public access for published posts, admin access for all
    let isAdmin = false;
    if (token) {
      const payload = verifyToken(token);
      if (payload && payload.role === 'admin') {
        isAdmin = true;
      }
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const published = searchParams.get('published');
    const slug = searchParams.get('slug');

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        "featuredImage" VARCHAR(500),
        author VARCHAR(255),
        category VARCHAR(255),
        tags TEXT[],
        published BOOLEAN DEFAULT false,
        "publishedAt" TIMESTAMP,
        views INTEGER DEFAULT 0,
        "seoTitle" VARCHAR(255),
        "seoDescription" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add indexes if they don't exist
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)');
    } catch (e: any) {}
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published)');
    } catch (e: any) {}
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category)');
    } catch (e: any) {}

    let query = 'SELECT * FROM blog_posts';
    const params: any[] = [];
    const conditions: string[] = [];

    // If fetching by slug (public access)
    if (slug) {
      conditions.push('slug = $' + (params.length + 1));
      params.push(slug);
      // Public can only see published posts by slug
      if (!isAdmin) {
        conditions.push('published = true');
        conditions.push('"publishedAt" IS NOT NULL');
      }
    } else {
      // Filter by published status
      if (published === 'true' || published === 'false') {
        conditions.push('published = $' + (params.length + 1));
        params.push(published === 'true');
      } else if (!isAdmin) {
        // Non-admin users can only see published posts
        conditions.push('published = true');
        conditions.push('"publishedAt" IS NOT NULL');
      }
    }

    // Filter by category
    if (category) {
      conditions.push('category = $' + (params.length + 1));
      params.push(category);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY "publishedAt" DESC NULLS LAST, "createdAt" DESC';

    const result = await pool.query(query, params);

    return NextResponse.json(
      {
        blogPosts: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get blog posts error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching blog posts', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new blog post
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      slug: providedSlug,
      excerpt,
      content,
      featuredImage,
      author,
      category,
      tags,
      published,
      seoTitle,
      seoDescription
    } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Generate slug from title if not provided
    const slug = providedSlug || generateSlug(title);
    
    // Ensure slug is unique
    let finalSlug = slug;
    let counter = 1;
    while (true) {
      const existing = await pool.query('SELECT id FROM blog_posts WHERE slug = $1 LIMIT 1', [finalSlug]);
      if (existing.rows.length === 0) break;
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    // Generate UUID
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const blogPostId = idResult.rows[0].id;

    // Handle arrays properly
    const tagsArray = tags && Array.isArray(tags) ? tags : (tags ? JSON.parse(JSON.stringify(tags)) : []);

    const publishedAt = published ? new Date() : null;

    const result = await pool.query(`
      INSERT INTO blog_posts (
        id, title, slug, excerpt, content, "featuredImage", author, category,
        tags, published, "publishedAt", views, "seoTitle", "seoDescription",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      blogPostId,
      title,
      finalSlug,
      excerpt || null,
      content,
      featuredImage || null,
      author || null,
      category || null,
      tagsArray.length > 0 ? tagsArray : null,
      published !== undefined ? published : false,
      publishedAt,
      seoTitle || null,
      seoDescription || null
    ]);

    const blogPost = result.rows[0];

    // Link any images in content that don't have blogPostId yet
    if (content) {
      try {
        // Add blogPostId column if it doesn't exist
        try {
          await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "blogPostId" VARCHAR(255)');
        } catch (e: any) {}

        // Extract image URLs from HTML content using regex
        const imageUrlRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const matches = content.matchAll(imageUrlRegex);
        const imageUrls: string[] = [];

        for (const match of matches) {
          if (match[1]) {
            imageUrls.push(match[1]);
          }
        }

        // Link images to blog post by matching URLs
        for (const url of imageUrls) {
          await pool.query(
            `UPDATE media SET "blogPostId" = $1 WHERE url = $2 AND category IN ('images', 'blog') AND "blogPostId" IS NULL`,
            [blogPostId, url]
          );
        }
      } catch (updateError) {
        console.error('Error linking images to blog post:', updateError);
        // Continue even if linking fails
      }
    }

    return NextResponse.json(
      {
        message: 'Blog post created successfully',
        blogPost: blogPost
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create blog post error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating blog post', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a blog post
export async function PUT(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      title,
      slug: providedSlug,
      excerpt,
      content,
      featuredImage,
      author,
      category,
      tags,
      published,
      seoTitle,
      seoDescription
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // Get current post to check if title/slug changed
    const current = await pool.query('SELECT title, slug, published, "publishedAt" FROM blog_posts WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const currentPost = current.rows[0];
    
    // Generate slug if title changed or slug provided
    let finalSlug = currentPost.slug;
    if (title && title !== currentPost.title) {
      finalSlug = providedSlug || generateSlug(title);
      
      // Ensure slug is unique (excluding current post)
      let counter = 1;
      let slugToCheck = finalSlug;
      while (true) {
        const existing = await pool.query('SELECT id FROM blog_posts WHERE slug = $1 AND id != $2 LIMIT 1', [slugToCheck, id]);
        if (existing.rows.length === 0) {
          finalSlug = slugToCheck;
          break;
        }
        slugToCheck = `${finalSlug}-${counter}`;
        counter++;
      }
    } else if (providedSlug) {
      finalSlug = providedSlug;
      
      // Ensure slug is unique (excluding current post)
      let counter = 1;
      let slugToCheck = finalSlug;
      while (true) {
        const existing = await pool.query('SELECT id FROM blog_posts WHERE slug = $1 AND id != $2 LIMIT 1', [slugToCheck, id]);
        if (existing.rows.length === 0) {
          finalSlug = slugToCheck;
          break;
        }
        slugToCheck = `${finalSlug}-${counter}`;
        counter++;
      }
    }

    // Handle published status - set publishedAt if publishing for first time
    let publishedAt = currentPost.publishedAt;
    if (published === true && !currentPost.published) {
      publishedAt = new Date();
    } else if (published === false) {
      publishedAt = null;
    }

    // Handle arrays properly
    const tagsArray = tags && Array.isArray(tags) ? tags : (tags ? JSON.parse(JSON.stringify(tags)) : []);

    const result = await pool.query(`
      UPDATE blog_posts
      SET 
        title = COALESCE($1, title),
        slug = $2,
        excerpt = $3,
        content = COALESCE($4, content),
        "featuredImage" = $5,
        author = $6,
        category = $7,
        tags = $8,
        published = COALESCE($9, published),
        "publishedAt" = $10,
        "seoTitle" = $11,
        "seoDescription" = $12,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      title,
      finalSlug,
      excerpt || null,
      content,
      featuredImage || null,
      author || null,
      category || null,
      tagsArray.length > 0 ? tagsArray : null,
      published,
      publishedAt,
      seoTitle || null,
      seoDescription || null,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const blogPost = result.rows[0];

    // Link any images in content to this blog post
    if (content) {
      try {
        // Add blogPostId column if it doesn't exist
        try {
          await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "blogPostId" VARCHAR(255)');
        } catch (e: any) {}

        // Extract image URLs from HTML content using regex
        const imageUrlRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const matches = content.matchAll(imageUrlRegex);
        const imageUrls: string[] = [];

        for (const match of matches) {
          if (match[1]) {
            imageUrls.push(match[1]);
          }
        }

        // Link images to blog post by matching URLs
        for (const url of imageUrls) {
          await pool.query(
            `UPDATE media SET "blogPostId" = $1 WHERE url = $2 AND category IN ('images', 'blog')`,
            [id, url]
          );
        }

        // Unlink images that are no longer in the content
        const currentUrls = imageUrls.map((url: string) => url.toLowerCase());
        if (currentUrls.length > 0) {
          await pool.query(
            `UPDATE media SET "blogPostId" = NULL WHERE "blogPostId" = $1 AND category IN ('images', 'blog') AND LOWER(url) != ALL($2::text[])`,
            [id, currentUrls]
          );
        }
      } catch (updateError) {
        console.error('Error linking images to blog post:', updateError);
        // Continue even if linking fails
      }
    }

    return NextResponse.json(
      {
        message: 'Blog post updated successfully',
        blogPost: blogPost
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update blog post error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating blog post', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a blog post
export async function DELETE(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
      `DELETE FROM blog_posts WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Blog post deleted successfully', deletedId: id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete blog post error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting blog post', details: error.message },
      { status: 500 }
    );
  }
}

