/**
 * Script to create an S3 bucket for Mayu Farm CMS
 * 
 * Usage:
 * 1. Set AWS credentials in .env.local:
 *    AWS_ACCESS_KEY_ID=your_key
 *    AWS_SECRET_ACCESS_KEY=your_secret
 *    AWS_S3_BUCKET_NAME=mayu-farm-storage
 *    AWS_REGION=ap-southeast-1
 * 
 * 2. Run: node scripts/create-s3-bucket.js
 */

require('dotenv').config({ path: '.env.local' });
const { S3Client, CreateBucketCommand, PutBucketPolicyCommand, PutPublicAccessBlockCommand } = require('@aws-sdk/client-s3');

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Error: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in .env.local');
  process.exit(1);
}

if (!AWS_S3_BUCKET_NAME || !AWS_REGION) {
  console.error('❌ Error: AWS_S3_BUCKET_NAME and AWS_REGION must be set in .env.local');
  process.exit(1);
}

// Create S3 client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function createBucket() {
  try {
    console.log('🚀 Creating S3 bucket...');
    console.log(`   Bucket name: ${AWS_S3_BUCKET_NAME}`);
    console.log(`   Region: ${AWS_REGION}`);

    // Create bucket
    const createCommand = new CreateBucketCommand({
      Bucket: AWS_S3_BUCKET_NAME,
      CreateBucketConfiguration: {
        LocationConstraint: AWS_REGION === 'us-east-1' ? undefined : AWS_REGION,
      },
    });

    await s3Client.send(createCommand);
    console.log('✅ Bucket created successfully!');

    // Allow public read access
    console.log('🔓 Configuring public read access...');
    
    const publicAccessBlockCommand = new PutPublicAccessBlockCommand({
      Bucket: AWS_S3_BUCKET_NAME,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    });

    await s3Client.send(publicAccessBlockCommand);
    console.log('✅ Public access configured!');

    // Set bucket policy for public read
    console.log('📋 Setting bucket policy...');
    
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${AWS_S3_BUCKET_NAME}/*`,
        },
      ],
    };

    const policyCommand = new PutBucketPolicyCommand({
      Bucket: AWS_S3_BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy),
    });

    await s3Client.send(policyCommand);
    console.log('✅ Bucket policy set!');

    console.log('\n🎉 Bucket setup complete!');
    console.log(`\n📋 Your bucket URL will be:`);
    console.log(`   https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/`);
    console.log(`\n📁 Files will be organized as:`);
    console.log(`   images/  - Image files`);
    console.log(`   videos/  - Video files`);
    console.log(`   files/  - Other files`);

  } catch (error) {
    if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
      console.log('ℹ️  Bucket already exists. That\'s fine!');
    } else if (error.name === 'BucketAlreadyExists') {
      console.error('❌ Error: Bucket name is already taken. Choose a different name.');
    } else {
      console.error('❌ Error creating bucket:', error.message);
      console.error('\nFull error:', error);
    }
    process.exit(1);
  }
}

createBucket();

