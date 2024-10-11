namespace NodeJS {
    type NODE_ENV = 'dev' | 'production';
    interface ProcessEnv {
        // UTILS
        PORT: string;
        NODE_ENV: NODE_ENV;
        CLIENT_URL: string;
        
        // DATABASE
        DATABASE_USERNAME: string;
        DATABASE_PASSWORD: string;
        DATABASE_URI: string;

        // JWT
        ACCESS_TOKEN_SECRET: string;
        ACCESS_TOKEN_EXPIRESIN: string;
        REFRESH_TOKEN_SECRET: string;
        REFRESH_TOKEN_EXPIRESIN: string;
        
        // MAILER
        MAILER_USER: string;
        MAILER_PASS: string;
        MAILER_HOST: string;
        
        // BUCKET
        BUCKET_PUBLIC_ENDPOINT: string;
        STORAGE_ENDPOINT: string;
        STORAGE_REGION: string;
        BUCKET_NAME: string;
        BUCKET_KEY_ID: string;
        BUCKET_SECRET: string;
    }
}

interface ENV extends NodeJS.ProcessEnv {
    [key: string]: string;
}