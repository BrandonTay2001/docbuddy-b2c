import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function uploadToR2(
  fileContent: Buffer | Blob,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    // Convert Blob to Buffer if necessary
    let buffer: Buffer;
    if (fileContent instanceof Blob) {
      const arrayBuffer = await fileContent.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = fileContent;
    }

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Return the public URL for the uploaded file
    return `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error('Failed to upload file to R2');
  }
}

// New function specifically for media uploads
export async function uploadMediaToR2(
  file: File,
  userId: string,
  sessionId?: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `media/${userId}/${sessionId || 'manual'}_${timestamp}_${sanitizedFileName}`;
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);
    return `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
  } catch (error) {
    console.error('Error uploading media to R2:', error);
    throw new Error('Failed to upload media file');
  }
}