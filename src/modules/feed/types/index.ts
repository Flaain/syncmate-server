import { HydratedDocument, SchemaTimestampsConfig } from 'mongoose';
import { Types } from 'mongoose';
import { Feed } from '../schemas/feed.schema';
import { Pagination } from 'src/utils/types';

export enum FEED_TYPE {
    CONVERSATION = 'Conversation',
    GROUP = 'Group',
    CLOUD = 'Cloud',
    ADS = 'ADS'
}

export interface IFeed {
    _id: Types.ObjectId;
    users: Array<Types.ObjectId>;
    item: Types.ObjectId;
    type: FEED_TYPE;
    createdAt?: Date;
    updatedAt?: Date;
}

export type FeedDocument = HydratedDocument<Feed> & SchemaTimestampsConfig;

export interface GetFeedParams {
    initiatorId: Types.ObjectId;
    cursor?: string;
}

export interface GetFeedPipelineParams {
    initiatorId: string | Types.ObjectId;
    cursor?: string;
    limit?: number;
}

export interface FeedWrapper<T> {
    _id: string;
    item: T;
    lastActionAt: string;
    type: FEED_TYPE
}

export type FeedSearchParams = Pick<Pagination, 'query' | 'limit' | 'page'> & { initiatorId: Types.ObjectId };