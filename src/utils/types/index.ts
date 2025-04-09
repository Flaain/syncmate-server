import { Document, FilterQuery, UpdateQuery as MongooseUpdateQuery, PipelineStage, ProjectionType, QueryOptions, Types, UpdateWithAggregationPipeline } from 'mongoose';
import { SessionDocument } from 'src/modules/session/types';
import { UserDocument } from 'src/modules/user/types';

export type RequestWithUser = Request & { doc: { user: UserDocument; sessionId: string } };
export type RequestWithSession = Request & { doc: { session: SessionDocument } };
export type SearchPipelineParams = IPagination & {
    initiatorId: Types.ObjectId;
    pipeline: Array<PipelineStage.FacetPipelineStage>;
};

export enum THROTTLERS {
    DEFAULT = 'DEFAULT',
    AUTH = 'AUTH',
    MESSAGE = 'MESSAGE',
}

export enum Routes {
    AUTH = 'auth',
    USER = 'user',
    FEED = 'feed',
    SESSION = 'session',
    CONVERSATION = 'conversation',
    PARTICIPANT = 'participant',
    MESSAGE = 'message',
    OTP = 'auth/otp',
}

export enum Providers {
    PARSER_CLIENT = 'PARSER_CLIENT',
    S3_CLIENT = 'S3_CLIENT',
    UA_PARSER = 'UA_PARSER',
}

export enum Cookies {
    ACCESS_TOKEN = 'accessToken',
    REFRESH_TOKEN = 'refreshToken',
}

export enum JWT_KEYS {
    ACCESS_TOKEN_SECRET = 'ACCESS_TOKEN_SECRET',
    ACCESS_TOKEN_EXPIRESIN = 'ACCESS_TOKEN_EXPIRESIN',
    REFRESH_TOKEN_SECRET = 'REFRESH_TOKEN_SECRET',
    REFRESH_TOKEN_EXPIRESIN = 'REFRESH_TOKEN_EXPIRESIN',
}

export enum AppExceptionCode {
    MISSING_ACCESS_TOKEN = 'MISSING_ACCESS_TOKEN',
    MISSING_REFRESH_TOKEN = 'MISSING_REFRESH_TOKEN',
    EXPIRED_ACCESS_TOKEN = 'EXPIRED_ACCESS_TOKEN',
    INVALID_ACCESS_TOKEN = 'INVALID_ACCESS_TOKEN',
    REFRESH_DENIED = 'REFRESH_DENIED',
    FORM = 'FORM',
}

export interface IAppException {
    message: string;
    errors?: Array<{ path: string; message: string }>;
    errorCode?: AppExceptionCode;
}

export interface ImplementAppException {
    message: string;
    errors?: Array<{ path: string; message: string }>;
    errorCode?: AppExceptionCode;
    statusCode: number;

    getErrorCode(): AppExceptionCode;
    getStatusCode(): number;
}

export interface IPagination {
    query: string;
    page: number;
    limit: number;
}

export interface PaginationWrapper<T> {
    page: number;
    limit: number;
    items: Array<T>;
    onSuccess?: (items: Array<T>) => Array<any>;
}

export interface WrappedInPagination<T> {
    items: Array<T>;
    total_items: number;
    current_page: number;
    total_pages: number;
    remaining_items: number;
}

export interface FindQuery<Doc extends Document> {
    filter: FilterQuery<Doc>, 
    projection?: ProjectionType<Doc>, 
    options?: QueryOptions<Doc>
}

export interface UpdateQuery<Doc extends Document, Options = QueryOptions<Doc>> {
    filter: FilterQuery<Doc>,
    update?: MongooseUpdateQuery<Doc> | UpdateWithAggregationPipeline,
    options?: Options,
}