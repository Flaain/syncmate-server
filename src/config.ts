import * as dotenv from 'dotenv';

export const config = () => dotenv.config().parsed as { [key: string]: string } & ENV