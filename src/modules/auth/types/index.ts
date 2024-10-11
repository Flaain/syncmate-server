import { Types } from 'mongoose';
import { SigninDTO } from '../dtos/auth.signin.dto';
import { SignupDTO } from '../dtos/auth.signup.dto';
import { Request, Response } from 'express';
import { RequestWithUser } from 'src/utils/types';
import { UserDocument, UserWithoutPassword } from 'src/modules/user/types';
import { HttpStatus } from '@nestjs/common';
import { User } from 'src/modules/user/schemas/user.schema';

export type WithAuthTokens<T, K extends string> = {
    [key in K]: T;
} & {
    accessToken: string;
    refreshToken: string;
};

export type WithUserAgent<T> = T & { userAgent?: string };
export type AuthChangePasswordType = 'set' | 'check';

export interface IAuthController {
    signin(dto: SigninDTO, req: Request, res: Response): Promise<UserWithoutPassword>;
    signup(dto: SignupDTO, req: Request, res: Response): Promise<UserWithoutPassword>;
    profile(req: RequestWithUser): Promise<UserWithoutPassword>;
    // refresh(req: Request, res: Response): Promise<void>;
    logout(req: RequestWithUser, res: Response): Promise<{ status: HttpStatus; message: string }>;
}

export interface IAuthService {
    signin(dto: WithUserAgent<SigninDTO>): Promise<WithAuthTokens<UserWithoutPassword, 'user'>>;
    signup(dto: WithUserAgent<SignupDTO>): Promise<WithAuthTokens<UserWithoutPassword, 'user'>>;
    profile(user: UserDocument): Promise<UserWithoutPassword>;
    validate(_id: Types.ObjectId | string): Promise<User>;
}