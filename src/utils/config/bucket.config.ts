import { registerAs } from '@nestjs/config';

export default registerAs('bucket', () => ({
    region: process.env.STORAGE_REGION,
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: {
        accessKeyId: process.env.BUCKET_KEY_ID,
        secretAccessKey: process.env.BUCKET_SECRET,
    },
}));