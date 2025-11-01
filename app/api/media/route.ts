import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { uploadToS3, deleteFromS3, getFolderFromMimeType, listS3Files } from '@/lib/s3';

// GET - Fetch all media files
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
    const category = searchParams.get('category');
    const syncFromS3 = searchParams.get('sync') === 'true';

    // Create table if it doesn't exist
    // Note: If table exists, we'll update it if needed
    await pool.query(`
      CREATE TABLE IF NOT EXISTS media (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        "originalName" VARCHAR(255) NOT NULL,
        "mimeType" VARCHAR(255) NOT NULL,
        size INTEGER NOT NULL,
        url VARCHAR(500) NOT NULL,
        alt TEXT,
        description TEXT,
        category VARCHAR(255),
        folder VARCHAR(255),
        "uploadedBy" VARCHAR(255),
        "accommodationId" VARCHAR(255),
        "animalId" VARCHAR(255),
        "teamMemberId" VARCHAR(255),
        "blogPostId" VARCHAR(255),
        "visionZoneName" VARCHAR(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Ensure updatedAt column has default (in case table was created before)
    try {
      await pool.query(`
        ALTER TABLE media 
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP
      `);
    } catch (error: any) {
      // Ignore if columns already have defaults or other errors
      // This is just to ensure defaults are set
    }

    // Add accommodationId, animalId, teamMemberId, and blogPostId columns if they don't exist
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "accommodationId" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "animalId" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "teamMemberId" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "blogPostId" VARCHAR(255)');
    } catch (e: any) {}

    // If sync requested, sync S3 files with database
    if (syncFromS3) {
      try {
        const s3Files = await listS3Files();
        
        // Get all files from S3
        const allS3Files = [
          ...s3Files.images.map(f => ({ ...f, folder: 'images' })),
          ...s3Files.videos.map(f => ({ ...f, folder: 'videos' })),
          ...s3Files.files.map(f => ({ ...f, folder: 'files' })),
          ...s3Files.team.map(f => ({ ...f, folder: 'team' })),
          ...s3Files.accommodation.map(f => ({ ...f, folder: 'accommodation' })),
          ...s3Files.animals.map(f => ({ ...f, folder: 'animals' })),
          ...s3Files.vision.map(f => ({ ...f, folder: 'vision' })),
          ...s3Files.gallery.map(f => ({ ...f, folder: 'gallery' })),
        ];

        // Sync with database - add files that don't exist in DB
        for (const s3File of allS3Files) {
          const key = s3File.key;
          // For gallery, keep the full path (e.g., "album-name/image.jpg")
          // For others, remove folder prefix (e.g., "vision/image.jpg" -> "image.jpg")
          const filename = s3File.folder === 'gallery' 
            ? key.replace('gallery/', '') // Keep album-name/image.jpg
            : key.split('/').slice(1).join('/'); // Remove folder prefix
          
          // Check if file exists in database (by URL or filename)
          const existing = await pool.query(
            'SELECT * FROM media WHERE url = $1 OR filename = $2 LIMIT 1',
            [s3File.url, filename]
          );

          // If file exists but has wrong category/folder, update it
          if (existing.rows.length > 0 && existing.rows[0].category !== s3File.folder) {
            await pool.query(`
              UPDATE media 
              SET category = $1, folder = $2, "updatedAt" = CURRENT_TIMESTAMP
              WHERE url = $3 OR filename = $4
            `, [s3File.folder, s3File.folder, s3File.url, filename]);
            continue; // Skip insertion, already updated
          }

          if (existing.rows.length === 0) {
            // File not in database, add it
            const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
            const mediaId = idResult.rows[0].id;
            
            // Determine mime type from filename
            const ext = filename.split('.').pop()?.toLowerCase();
            let mimeType = 'application/octet-stream';
            if (s3File.folder === 'images' || s3File.folder === 'team' || s3File.folder === 'accommodation' || s3File.folder === 'animals' || s3File.folder === 'vision' || s3File.folder === 'gallery') {
              mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                         ext === 'png' ? 'image/png' :
                         ext === 'gif' ? 'image/gif' :
                         ext === 'webp' ? 'image/webp' :
                         ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
            } else if (s3File.folder === 'videos') {
              mimeType = ext === 'mp4' ? 'video/mp4' :
                         ext === 'mov' ? 'video/quicktime' :
                         ext === 'avi' ? 'video/x-msvideo' : 'video/mp4';
            }

            // Extract vision zone name from filename (e.g., "dao-home-123.jpg" -> "dao-home")
            let visionZoneName = null;
            if (s3File.folder === 'vision') {
              const nameMatch = filename.match(/^(dao-home|lilac|mayu|ecosystem)-/);
              if (nameMatch) {
                visionZoneName = nameMatch[1];
              }
            }

            // Use full filename as originalName for gallery (includes album path)
            const originalName = s3File.folder === 'gallery' 
              ? filename.split('/').pop() || filename // Just the image name
              : filename;

            await pool.query(`
              INSERT INTO media (id, filename, "originalName", "mimeType", size, url, category, folder, "visionZoneName", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
              mediaId,
              filename, // Full path for gallery, just filename for others
              originalName,
              mimeType,
              s3File.size || 0,
              s3File.url,
              s3File.folder, // category
              s3File.folder, // folder
              visionZoneName,
            ]);
          }
        }
      } catch (error: any) {
        console.error('Error syncing from S3:', error);
        // Continue even if sync fails - still return database media
      }
    }

    // Build query with JOINs to get related entity names
    let query = `
      SELECT 
        m.*,
        a.name as "accommodationName",
        an.name as "animalName",
        tm.name as "teamMemberName",
        bp.title as "blogPostTitle"
      FROM media m
      LEFT JOIN accommodations a ON m."accommodationId" = a.id
      LEFT JOIN animals an ON m."animalId" = an.id
      LEFT JOIN team_members tm ON m."teamMemberId" = tm.id
      LEFT JOIN blog_posts bp ON m."blogPostId" = bp.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];

    if (category) {
      conditions.push('m.category = $' + (params.length + 1));
      params.push(category);
    }

    // Support filtering by accommodationId
    const accommodationId = searchParams.get('accommodationId');
    if (accommodationId) {
      conditions.push('m."accommodationId" = $' + (params.length + 1));
      params.push(accommodationId);
    }

    // Support filtering by animalId
    const animalId = searchParams.get('animalId');
    if (animalId) {
      conditions.push('m."animalId" = $' + (params.length + 1));
      params.push(animalId);
    }

    // Support filtering by teamMemberId
    const teamMemberId = searchParams.get('teamMemberId');
    if (teamMemberId) {
      conditions.push('m."teamMemberId" = $' + (params.length + 1));
      params.push(teamMemberId);
    }

    // Support filtering by blogPostId
    const blogPostId = searchParams.get('blogPostId');
    if (blogPostId) {
      conditions.push('m."blogPostId" = $' + (params.length + 1));
      params.push(blogPostId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY m."createdAt" DESC';

    const result = await pool.query(query, params);

    return NextResponse.json(
      {
        media: result.rows || [],
        count: result.rows.length
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get media error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching media', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Upload media file
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;
    const alt = formData.get('alt') as string;
    const description = formData.get('description') as string;
    const accommodationId = formData.get('accommodationId') as string | null;
    const animalId = formData.get('animalId') as string | null;
    const teamMemberId = formData.get('teamMemberId') as string | null;
    const blogPostId = formData.get('blogPostId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const extension = originalName.split('.').pop();
    const filename = `${timestamp}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Determine folder based on file type or category
    const folder = category === 'images' || category === 'videos' || category === 'team' || category === 'accommodation' || category === 'animals'
      ? category 
      : getFolderFromMimeType(file.type);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3
    const url = await uploadToS3(buffer, filename, file.type, folder);

    // Generate UUID for the media record
    const idResult = await pool.query('SELECT gen_random_uuid()::text as id');
    const mediaId = idResult.rows[0].id;

    // Add accommodationId, animalId, teamMemberId, and blogPostId columns if they don't exist
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "accommodationId" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "animalId" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "teamMemberId" VARCHAR(255)');
    } catch (e: any) {}
    try {
      await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS "blogPostId" VARCHAR(255)');
    } catch (e: any) {}

    // Save to database
    const result = await pool.query(`
      INSERT INTO media (id, filename, "originalName", "mimeType", size, url, alt, description, category, "uploadedBy", "accommodationId", "animalId", "teamMemberId", "blogPostId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      mediaId,
      filename,
      originalName,
      file.type,
      file.size,
      url,
      alt || null,
      description || null,
      category || null,
      payload.email,
      accommodationId || null,
      animalId || null,
      teamMemberId || null,
      blogPostId || null
    ]);

    return NextResponse.json(
      {
        message: 'File uploaded successfully',
        media: result.rows[0]
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Upload media error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'An error occurred while uploading file';
    const errorDetails = error.details || error.code || 'No additional details';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        // Include S3-specific error info if available
        ...(error.name && { errorType: error.name }),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete media file
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
    const idsParam = searchParams.get('ids'); // For multiple IDs: ?ids=id1,id2,id3

    // Support both single ID and multiple IDs
    let ids: string[] = [];
    if (idsParam) {
      // Multiple IDs provided
      ids = idsParam.split(',').filter(id => id.trim() !== '');
    } else if (id) {
      // Single ID provided
      ids = [id];
    } else {
      // Try to get from request body for bulk delete
      try {
        const body = await request.json();
        if (body.ids && Array.isArray(body.ids)) {
          ids = body.ids;
        } else if (body.id) {
          ids = [body.id];
        }
      } catch (e) {
        // Body might not be JSON, that's okay
      }
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'ID or IDs are required' },
        { status: 400 }
      );
    }

    // Get file info from database for all IDs
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const fileResult = await pool.query(
      `SELECT * FROM media WHERE id IN (${placeholders})`,
      ids
    );

    if (fileResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No media found with provided IDs' },
        { status: 404 }
      );
    }

    const mediaFiles = fileResult.rows;
    const deletedFromS3: string[] = [];
    const failedS3Deletes: string[] = [];

    // Before deleting, remove image URLs from related entities
    for (const media of mediaFiles) {
      const imageUrl = media.url;

      // Remove from accommodation if linked
      if (media.accommodationId) {
        try {
          // Get current imageUrls array
          const accResult = await pool.query(
            'SELECT "imageUrls" FROM accommodations WHERE id = $1',
            [media.accommodationId]
          );
          
          if (accResult.rows.length > 0) {
            let imageUrls = accResult.rows[0].imageUrls || [];
            
            // Handle both array and string formats
            if (typeof imageUrls === 'string') {
              try {
                imageUrls = JSON.parse(imageUrls);
              } catch (e) {
                // If parsing fails, treat as PostgreSQL array string
                imageUrls = imageUrls.replace(/[{}]/g, '').split(',').map((url: string) => url.trim().replace(/"/g, ''));
              }
            }
            
            // Remove the deleted image URL
            const updatedUrls = Array.isArray(imageUrls) 
              ? imageUrls.filter((url: string) => url !== imageUrl && url !== media.url)
              : [];
            
            // Update accommodation with filtered URLs
            await pool.query(
              'UPDATE accommodations SET "imageUrls" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
              [updatedUrls.length > 0 ? updatedUrls : null, media.accommodationId]
            );
          }
        } catch (error: any) {
          console.error(`Error removing image from accommodation ${media.accommodationId}:`, error);
          // Continue even if update fails
        }
      }

      // Remove from team member if linked
      if (media.teamMemberId) {
        try {
          const teamResult = await pool.query(
            'SELECT "photoUrl" FROM team_members WHERE id = $1',
            [media.teamMemberId]
          );
          
          if (teamResult.rows.length > 0 && teamResult.rows[0].photoUrl === imageUrl) {
            // Clear photoUrl if it matches the deleted image
            await pool.query(
              'UPDATE team_members SET "photoUrl" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
              [media.teamMemberId]
            );
          }
        } catch (error: any) {
          console.error(`Error removing photo from team member ${media.teamMemberId}:`, error);
          // Continue even if update fails
        }
      }

      // Remove from animal if linked
      if (media.animalId) {
        try {
          // Get current photoUrls array
          const animalResult = await pool.query(
            'SELECT "photoUrls" FROM animals WHERE id = $1',
            [media.animalId]
          );
          
          if (animalResult.rows.length > 0) {
            let photoUrls = animalResult.rows[0].photoUrls || [];
            
            // Handle both array and string formats
            if (typeof photoUrls === 'string') {
              try {
                photoUrls = JSON.parse(photoUrls);
              } catch (e) {
                // If parsing fails, treat as PostgreSQL array string
                photoUrls = photoUrls.replace(/[{}]/g, '').split(',').map((url: string) => url.trim().replace(/"/g, ''));
              }
            }
            
            // Remove the deleted image URL
            const updatedUrls = Array.isArray(photoUrls) 
              ? photoUrls.filter((url: string) => url !== imageUrl && url !== media.url)
              : [];
            
            // Update animal with filtered URLs
            await pool.query(
              'UPDATE animals SET "photoUrls" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
              [updatedUrls.length > 0 ? updatedUrls : null, media.animalId]
            );
          }
        } catch (error: any) {
          console.error(`Error removing photo from animal ${media.animalId}:`, error);
          // Continue even if update fails
        }
      }

      // Remove from blog post if linked
      if (media.blogPostId) {
        try {
          const blogResult = await pool.query(
            'SELECT "featuredImage", content FROM blog_posts WHERE id = $1',
            [media.blogPostId]
          );
          
          if (blogResult.rows.length > 0) {
            const blogPost = blogResult.rows[0];
            let updatedContent = blogPost.content;
            let updatedFeaturedImage = blogPost.featuredImage;
            
            // Clear featuredImage if it matches the deleted image
            if (blogPost.featuredImage === imageUrl) {
              updatedFeaturedImage = null;
            }
            
            // Remove image from HTML content if it exists
            if (blogPost.content && blogPost.content.includes(imageUrl)) {
              // Remove img tags that reference this URL
              const imgTagRegex = new RegExp(`<img[^>]*src=["']${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'gi');
              updatedContent = blogPost.content.replace(imgTagRegex, '');
              
              // Clean up any empty paragraphs or divs left behind
              updatedContent = updatedContent.replace(/<p[^>]*>\s*<\/p>/gi, '');
              updatedContent = updatedContent.replace(/<div[^>]*>\s*<\/div>/gi, '');
            }
            
            // Update blog post
            await pool.query(
              'UPDATE blog_posts SET "featuredImage" = $1, content = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3',
              [updatedFeaturedImage, updatedContent, media.blogPostId]
            );
          }
        } catch (error: any) {
          console.error(`Error removing image from blog post ${media.blogPostId}:`, error);
          // Continue even if update fails
        }
      }

      // Remove from vision content if linked
      if (media.visionZoneName || media.folder === 'vision') {
        try {
          // Get vision content
          const visionResult = await pool.query(
            'SELECT * FROM vision_content ORDER BY "createdAt" DESC LIMIT 1'
          );
          
          if (visionResult.rows.length > 0) {
            const visionContent = visionResult.rows[0];
            let zones = [];
            
            // Parse zones
            if (visionContent.zones) {
              if (typeof visionContent.zones === 'string') {
                try {
                  zones = JSON.parse(visionContent.zones);
                } catch (e) {
                  zones = [];
                }
              } else if (Array.isArray(visionContent.zones)) {
                zones = visionContent.zones;
              }
            }
            
            // Update zones to remove deleted image
            let updatedZones = zones.map((zone: any) => {
              if (zone.imageUrl === imageUrl) {
                return { ...zone, imageUrl: '' };
              }
              return zone;
            });
            
            // Check ecosystem image
            let ecosystemImageUrl = visionContent.ecosystemImageUrl;
            if (ecosystemImageUrl === imageUrl) {
              ecosystemImageUrl = null;
            }
            
            // Update vision content
            await pool.query(
              'UPDATE vision_content SET zones = $1, "ecosystemImageUrl" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3',
              [JSON.stringify(updatedZones), ecosystemImageUrl, visionContent.id]
            );
          }
        } catch (error: any) {
          console.error(`Error removing image from vision content:`, error);
          // Continue even if update fails
        }
      }

      // Remove from gallery if linked (gallery images are managed separately, but we should also clean up)
      if (media.folder === 'gallery' || media.category === 'gallery') {
        try {
          // Check if this image exists in gallery_images table
          const galleryImageResult = await pool.query(
            'SELECT id, "albumId" FROM gallery_images WHERE url = $1',
            [imageUrl]
          );
          
          // If found, delete from gallery_images (cascade will handle album updates)
          if (galleryImageResult.rows.length > 0) {
            for (const galleryImage of galleryImageResult.rows) {
              // Delete the gallery image record
              await pool.query('DELETE FROM gallery_images WHERE id = $1', [galleryImage.id]);
              
              // Update album image count and cover image if needed
              const albumResult = await pool.query(
                'SELECT "imageCount", "coverImageUrl" FROM gallery_albums WHERE id = $1',
                [galleryImage.albumId]
              );
              
              if (albumResult.rows.length > 0) {
                const album = albumResult.rows[0];
                const newImageCount = Math.max(0, (album.imageCount || 0) - 1);
                
                // If this was the cover image, set cover to null
                let coverImageUrl = album.coverImageUrl;
                if (coverImageUrl === imageUrl) {
                  coverImageUrl = null;
                }
                
                await pool.query(
                  'UPDATE gallery_albums SET "imageCount" = $1, "coverImageUrl" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3',
                  [newImageCount, coverImageUrl, galleryImage.albumId]
                );
              }
            }
          }
        } catch (error: any) {
          console.error(`Error removing image from gallery:`, error);
          // Continue even if update fails
        }
      }
    }

    // Delete files from S3
    for (const media of mediaFiles) {
      if (media.url && media.url.startsWith('https://')) {
        try {
          await deleteFromS3(media.url);
          deletedFromS3.push(media.id);
        } catch (fileError: any) {
          console.error(`Error deleting file ${media.id} from S3:`, fileError);
          failedS3Deletes.push(media.id);
          // Continue to delete from database even if S3 deletion fails
        }
      }
    }

    // Delete from database
    await pool.query(
      `DELETE FROM media WHERE id IN (${placeholders})`,
      ids
    );

    return NextResponse.json(
      {
        message: `Successfully deleted ${mediaFiles.length} file(s)`,
        deleted: mediaFiles.length,
        deletedFromS3: deletedFromS3.length,
        failedS3Deletes: failedS3Deletes.length,
        failedIds: failedS3Deletes.length > 0 ? failedS3Deletes : undefined,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete media error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting media', details: error.message },
      { status: 500 }
    );
  }
}

