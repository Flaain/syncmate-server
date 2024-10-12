import { z } from 'zod';
import { User } from '../schemas/user.schema';
import { HydratedDocument, Types } from 'mongoose';
import { HttpStatus } from '@nestjs/common';
import { Pagination, RequestWithUser, WrappedInPagination } from 'src/utils/types';
import { userCheckSchema } from '../schemas/user.check.schema';

export enum PRESENCE {
    ONLINE = 'online',
    OFFLINE = 'offline'
}

export type CheckType = 'email' | 'login';

export type UserDocument = HydratedDocument<User>;
export type UserSearchParams = Pagination & { initiatorId: Types.ObjectId };

export interface IUserController {
    check(type: CheckType, email: string, login: string): Promise<{ status: HttpStatus; message: string }>;
    search(req: RequestWithUser, pagination: Pagination): Promise<WrappedInPagination<Array<Pick<UserDocument, '_id' | 'name' | 'login' | 'isOfficial'>>>>;
}

export interface IUserService {
    check: ({ type, email, login }: z.infer<typeof userCheckSchema>) => Promise<{ status: HttpStatus; message: string }>;
    search: ({ initiatorId, query, page, limit }: UserSearchParams) => Promise<Array<Pick<UserDocument, '_id' | 'name' | 'login'>>>;
}