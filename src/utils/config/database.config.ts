import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
    name: process.env.DATABASE_NAME,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    URI: process.env.DATABASE_URI,
}));