import { z } from 'zod';
import { User } from '../schemas/user.schema';
import { Document, SchemaTimestampsConfig, Types } from 'mongoose';
import { HttpStatus } from '@nestjs/common';
import { Pagination, RequestWithUser, WrappedInPagination } from 'src/utils/types';
import { userCheckSchema } from '../schemas/user.check.schema';

export enum PRESENCE {
    ONLINE = 'online',
    OFFLINE = 'offline'
}

export type CheckType = 'email' | 'login';

export type UserWithoutPassword = Omit<IUser, 'password'>;
export type UserDocument = User & Document & SchemaTimestampsConfig;
export type UserSearchParams = Pagination & { initiatorId: Types.ObjectId };

export interface IUser {
    _id: Types.ObjectId;
    password: string;
    name: string;
    login: string;
    email: string;
    birthDate: Date;
    avatar?: string | Types.ObjectId;
    lastSeenAt?: Date;
    isPrivate?: boolean;
    isDeleted?: boolean;
    isOfficial?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    presence?: PRESENCE;
}

export interface IUserController {
    check(type: CheckType, email: string, login: string): Promise<{ status: HttpStatus; message: string }>;
    search(req: RequestWithUser, pagination: Pagination): Promise<WrappedInPagination<Array<Pick<UserDocument, '_id' | 'name' | 'login' | 'isOfficial'>>>>;
}

export interface IUserService {
    check: ({ type, email, login }: z.infer<typeof userCheckSchema>) => Promise<{ status: HttpStatus; message: string }>;
    search: ({ initiatorId, query, page, limit }: UserSearchParams) => Promise<Array<Pick<IUser, '_id' | 'name' | 'login'>>>;
}