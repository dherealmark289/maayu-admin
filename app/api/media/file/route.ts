import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import pool from '@/lib/db';

// GET - Serve media files from backend/storage
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const category = searchParams.get('category') || 'images';

    if (!id) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // First, try to get file info from database to get the actual filename
    let filename = id;
    let actualCategory = category;
    
    try {
      const dbResult = await pool.query(
        'SELECT filename, category, "mimeType" FROM media WHERE filename = $1 OR id = $1 LIMIT 1',
        [id]
      );
      
      if (dbResult.rows.length > 0) {
        filename = dbResult.rows[0].filename;
        actualCategory = dbResult.rows[0].category || category;
      }
    } catch (dbError) {
      // If database lookup fails, use provided id and category
      console.log('Could not fetch file from database, using provided params');
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = filename.replace(/\.\./g, '').replace(/\//g, '');
    const sanitizedCategory = actualCategory.replace(/\.\./g, '').replace(/\//g, '');

    // Path to file in backend/storage
    const filepath = join(process.cwd(), 'backend', 'storage', sanitizedCategory, sanitizedFilename);

    if (!existsSync(filepath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filepath);

    // Determine content type from filename or database
    const extension = sanitizedFilename.split('.').pop()?.toLowerCase();
    let contentType = getContentType(extension || '');
    
    // If we have mimeType from database, use it
    try {
      const dbResult = await pool.query(
        'SELECT "mimeType" FROM media WHERE filename = $1 LIMIT 1',
        [sanitizedFilename]
      );
      if (dbResult.rows.length > 0 && dbResult.rows[0].mimeType) {
        contentType = dbResult.rows[0].mimeType;
      }
    } catch (e) {
      // Use extension-based type if database lookup fails
    }

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sanitizedFilename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Serve file error:', error);
    return NextResponse.json(
      { error: 'An error occurred while serving file', details: error.message },
      { status: 500 }
    );
  }
}

function getContentType(extension: string): string {
  const contentTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'zip': 'application/zip',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
  };

  return contentTypes[extension] || 'application/octet-stream';
}

