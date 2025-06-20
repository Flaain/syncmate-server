import { z } from 'zod';
import { User } from '../schemas/user.schema';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { HttpStatus } from '@nestjs/common';
import { IPagination, RequestWithUser, WrappedInPagination } from 'src/utils/types';
import { userCheckSchema } from '../schemas/user.check.schema';

export enum PRESENCE {
    ONLINE = 'online',
    OFFLINE = 'offline'
}

export enum USER_EVENTS {
    PRESENCE = 'user.presence'
}

export const PRIVACY_MODE = {
    0: 'nobody',
    1: 'everybody',
} as const;

export type CheckType = 'email' | 'login';
export type PrivacyMode = keyof typeof PRIVACY_MODE;
export type UserDocument = HydratedDocument<User>;
export type UserSearchParams = IPagination & { initiatorId: Types.ObjectId };

export interface IUserController {
    check(type: CheckType, email: string, login: string): Promise<{ status: HttpStatus; message: string }>;
    search(req: RequestWithUser, pagination: IPagination): Promise<WrappedInPagination<Array<Pick<UserDocument, '_id' | 'name' | 'login' | 'isOfficial'>>>>;
}

export interface IUserService {
    check: ({ type, email, login }: z.infer<typeof userCheckSchema>) => Promise<{ status: HttpStatus; message: string }>;
    search: ({ initiatorId, query, page, limit }: UserSearchParams) => Promise<Array<Pick<UserDocument, '_id' | 'name' | 'login'>>>;
}

export interface PrivacySetting {
    mode: PrivacyMode,
    deny?: Array<mongoose.Types.ObjectId>;
    allow?: Array<mongoose.Types.ObjectId>;
}