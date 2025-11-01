import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import pool from '@/lib/db';
import { uploadToS3 } from '@/lib/s3';
import mammoth from 'mammoth';
import { Buffer } from 'buffer';

// Helper function to compress image (same as in frontend)
async function compressImage(buffer: Buffer, mimeType: string, maxSizeKB: number = 500): Promise<Buffer> {
  // For server-side, we'll just return the buffer as-is
  // In production, you'd use Sharp or similar library
  // For now, we'll upload original - you can add compression later with Sharp
  return buffer;
}

// POST - Upload Word document and convert to HTML
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

    const formData = await request.formData();
    const file = formData.get('document') as File;
    const blogPostId = formData.get('blogPostId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check if it's a Word document
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(doc|docx)$/i)) {
      return NextResponse.json(
        { error: 'File must be a Word document (.doc or .docx)' },
        { status: 400 }
      );
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Convert Word document to HTML using mammoth
    let htmlResult;
    try {
      htmlResult = await mammoth.convertToHtml({ buffer }, {
        convertImage: mammoth.images.imgElement(async (image) => {
          // Extract image from Word document
          const imageBuffer = await image.read();
          const contentType = image.contentType;

          if (!imageBuffer || !contentType) {
            return { src: '' };
          }

          // Generate unique filename for image
          const timestamp = Date.now();
          const filename = `${timestamp}-image-${Math.random().toString(36).substring(7)}.${contentType.split('/')[1] || 'png'}`;

          // Upload image to S3 in images folder (we'll link to blog post via blogPostId)
          const imageUrl = await uploadToS3(
            Buffer.from(imageBuffer),
            filename,
            contentType,
            'images' // Store in images folder, but we'll link to blog post via blogPostId
          );

          // Save image to media database with blogPostId
          try {
            // Add blogPostId column if it doesn't exist
            try {
              await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "blogPostId" VARCHAR(255)');
            } catch (e: any) {}

            const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
            const mediaId = idResult.rows[0].id;

            await pool.query(`
              INSERT INTO media (id, filename, "originalName", "mimeType", size, url, category, "blogPostId", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO NOTHING
            `, [
              mediaId,
              filename,
              `extracted-${filename}`,
              contentType,
              imageBuffer.length,
              imageUrl,
              'blog',
              blogPostId || null,
            ]);
          } catch (dbError) {
            console.error('Error saving image to media database:', dbError);
            // Continue even if database save fails
          }

          return { src: imageUrl };
        }),
      });
    } catch (error: any) {
      console.error('Error converting Word document:', error);
      return NextResponse.json(
        { error: 'Failed to convert Word document', details: error.message },
        { status: 500 }
      );
    }

    const html = htmlResult.value;
    const messages = htmlResult.messages || [];

    return NextResponse.json(
      {
        message: 'Document converted successfully',
        html: html,
        messages: messages,
        warnings: messages.filter((m: any) => m.type === 'warning'),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Upload document error:', error);
    return NextResponse.json(
      { error: 'An error occurred while uploading document', details: error.message },
      { status: 500 }
    );
  }
}

