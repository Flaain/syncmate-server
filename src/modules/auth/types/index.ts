import { z } from "zod";
import { signupSchema } from "../schemas/auth.signup.schema";
import { signinSchema } from "../schemas/auth.signin.schema";
import { authChangePasswordSchema } from "../schemas/auth.change.password.schema";
import { authResetSchema } from "../schemas/auth.reset.schema";

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

export type TokenType = 'access' | 'refresh';

export type SignupDTO = z.infer<typeof signupSchema>;
export type SigninDTO = z.infer<typeof signinSchema>;

export type AuthChangePasswordDTO = z.infer<typeof authChangePasswordSchema>;
export type AuthResetDTO = z.infer<typeof authResetSchema>;