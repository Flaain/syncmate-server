import { HydratedDocument, SchemaTimestampsConfig } from 'mongoose';
import { Types } from 'mongoose';
import { Feed } from '../schemas/feed.schema';
import { Pagination } from 'src/utils/types';
import { ConversationDocument } from 'src/modules/conversation/types';
import { UserDocument } from 'src/modules/user/types';

export enum FEED_TYPE {
    CONVERSATION = 'Conversation',
    GROUP = 'Group',
    CLOUD = 'Cloud',
    ADS = 'ADS'
}

export interface ConversationFeed extends Pick<ConversationDocument, '_id' | 'lastMessage'> {
    recipient: UserDocument;
}

export interface FeedWrapper<T> {
    _id: string;
    item: T;
    lastActionAt: string;
    type: FEED_TYPE
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

export type FeedSearchParams = Pick<Pagination, 'query' | 'limit' | 'page'> & { initiatorId: Types.ObjectId };