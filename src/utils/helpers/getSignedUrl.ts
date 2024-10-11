import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl as getSignedUrlS3 } from '@aws-sdk/s3-request-presigner';

export const getSignedUrl = (client: S3Client, key: string) =>
    getSignedUrlS3(client, new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key }), { expiresIn: 900 });