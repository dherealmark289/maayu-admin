import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Validate AWS credentials
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'maaayufarmstorage';

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('AWS credentials not found in environment variables');
  console.error('AWS_ACCESS_KEY_ID:', AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
  console.error('AWS_SECRET_ACCESS_KEY:', AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
}

// Initialize S3 client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID || '',
    secretAccessKey: AWS_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Upload file to S3
 * @param file Buffer of the file to upload
 * @param filename Filename to use in S3
 * @param contentType MIME type of the file
 * @param folder Folder path in S3 (e.g., 'images', 'videos', 'files')
 * @returns S3 URL of the uploaded file
 */
export async function uploadToS3(
  file: Buffer,
  filename: string,
  contentType: string,
  folder: 'images' | 'videos' | 'files' | 'team' | 'accommodation' | 'animals' | string = 'files'
): Promise<string> {
  try {
    // Validate credentials
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured. Please check your .env.local file.');
    }

    if (!BUCKET_NAME) {
      throw new Error('AWS S3 bucket name is not configured.');
    }

    const key = `${folder}/${filename}`;

    console.log('Uploading to S3:', {
      bucket: BUCKET_NAME,
      key: key,
      region: AWS_REGION,
      contentType: contentType,
      fileSize: file.length,
    });

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
      // Note: For newer buckets, ACL might be disabled
      // We'll rely on bucket policy for public read access
    });

    await s3Client.send(command);

    // Return the public URL
    const url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    console.log('File uploaded successfully:', url);

    return url;
  } catch (error: any) {
    console.error('S3 upload error details:', {
      message: error.message,
      name: error.name,
      code: error.Code || error.code,
      region: AWS_REGION,
      bucket: BUCKET_NAME,
      hasCredentials: !!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY),
    });
    
    // Provide more helpful error messages
    if (error.name === 'CredentialsProviderError' || error.message?.includes('credentials')) {
      throw new Error('AWS credentials are invalid or missing. Please check your .env.local file.');
    }
    if (error.name === 'NoSuchBucket' || error.Code === 'NoSuchBucket') {
      throw new Error(`S3 bucket "${BUCKET_NAME}" does not exist. Please check your bucket name.`);
    }
    if (error.name === 'Forbidden' || error.Code === 'AccessDenied') {
      throw new Error('Access denied. Please check your AWS credentials and IAM permissions.');
    }
    
    throw new Error(`Failed to upload file to S3: ${error.message || error.Code || 'Unknown error'}`);
  }
}

/**
 * Delete file from S3
 * @param url S3 URL of the file to delete
 */
export async function deleteFromS3(url: string): Promise<void> {
  try {
    // Extract key from URL
    // Format: https://bucket.s3.region.amazonaws.com/folder/filename
    const urlObj = new URL(url);
    const key = urlObj.pathname.substring(1); // Remove leading '/'

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error: any) {
    console.error('S3 delete error:', error);
    // Don't throw - allow deletion to continue even if S3 deletion fails
    // This prevents database inconsistencies
  }
}

/**
 * Get the S3 URL for a file
 * @param filename Filename
 * @param folder Folder path in S3
 * @returns S3 URL
 */
export function getS3Url(filename: string, folder: 'images' | 'videos' | 'files' = 'files'): string {
  const region = process.env.AWS_REGION || 'eu-west-1';
  return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${folder}/${filename}`;
}

/**
 * Determine folder based on file type
 */
export function getFolderFromMimeType(mimeType: string): 'images' | 'videos' | 'files' {
  if (mimeType.startsWith('image/')) {
    return 'images';
  }
  if (mimeType.startsWith('video/')) {
    return 'videos';
  }
  return 'files';
}

/**
 * Upload file to S3 with custom folder support (for team, etc.)
 */
export async function uploadToS3WithFolder(
  file: Buffer,
  filename: string,
  contentType: string,
  folder: string
): Promise<string> {
  try {
    // Validate credentials
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured. Please check your .env.local file.');
    }

    if (!BUCKET_NAME) {
      throw new Error('AWS S3 bucket name is not configured.');
    }

    const key = `${folder}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Return the public URL
    const url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    return url;
  } catch (error: any) {
    console.error('S3 upload error details:', {
      message: error.message,
      name: error.name,
      code: error.Code || error.code,
    });
    throw new Error(`Failed to upload file to S3: ${error.message || error.Code || 'Unknown error'}`);
  }
}

/**
 * List all files in S3 bucket organized by folder
 */
export async function listS3Files(): Promise<{
  images: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
  videos: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
  files: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
  team: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
  accommodation: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
  animals: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
  vision: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
  gallery: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
}> {
  try {
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured.');
    }

    if (!BUCKET_NAME) {
      throw new Error('AWS S3 bucket name is not configured.');
    }

    const result: {
      images: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
      videos: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
      files: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
      team: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
      accommodation: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
      animals: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
      vision: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
      gallery: Array<{ key: string; url: string; size?: number; lastModified?: Date }>;
    } = {
      images: [],
      videos: [],
      files: [],
      team: [],
      accommodation: [],
      animals: [],
      vision: [],
      gallery: [],
    };

    // List all objects in the bucket
    let continuationToken: string | undefined;
    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          if (!object.Key) continue;

          // Skip if it's a folder (ends with /)
          if (object.Key.endsWith('/')) continue;

          const url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${object.Key}`;
          
          // Determine folder from key
          const parts = object.Key.split('/');
          const firstPart = parts[0] as 'images' | 'videos' | 'files' | 'team' | 'accommodation' | 'animals' | 'vision' | 'gallery';
          const filename = parts.slice(1).join('/');

          // Handle gallery subfolders (e.g., gallery/album-name/image.jpg)
          // All gallery subfolders should be treated as 'gallery'
          let folder: 'images' | 'videos' | 'files' | 'team' | 'accommodation' | 'animals' | 'vision' | 'gallery' = firstPart;
          if (firstPart === 'gallery' || object.Key.startsWith('gallery/')) {
            folder = 'gallery';
          }

          // Only process files in our known folders
          if (folder === 'images' || folder === 'videos' || folder === 'files' || folder === 'team' || folder === 'accommodation' || folder === 'animals' || folder === 'vision' || folder === 'gallery') {
            result[folder].push({
              key: object.Key,
              url: url,
              size: object.Size,
              lastModified: object.LastModified,
            });
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return result;
  } catch (error: any) {
    console.error('S3 list error:', error);
    throw new Error(`Failed to list files from S3: ${error.message}`);
  }
}

