export type WithAuthTokens<T, K extends string> = {
    [key in K]: T;
} & {
    accessToken: string;
    refreshToken: string;
};

export type WithUserAgent<T> = T & { userAgent?: string };
export type AuthChangePasswordType = 'set' | 'check';