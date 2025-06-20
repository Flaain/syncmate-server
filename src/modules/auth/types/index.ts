export enum ROLES {
    ADMIN = 'admin',
    MODERATOR = 'moderator',
    USER = 'user'
}

export type ERoles = `${ROLES}`;

export type WithAuthTokens<T, K extends string> = {
    [key in K]: T;
} & {
    accessToken: string;
    refreshToken: string;
};

export type WithUserAgent<T> = T & { userAgent?: string; userIP?: string };
export type AuthChangePasswordType = 'set' | 'check';
export type TokenType = 'access' | 'refresh';