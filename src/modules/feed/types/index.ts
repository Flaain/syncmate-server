import { Document, SchemaTimestampsConfig } from 'mongoose';
import { Types } from 'mongoose';
import { Feed } from '../schemas/feed.schema';

export enum FEED_TYPE {
    CONVERSATION = 'Conversation',
    GROUP = 'Group',
    CLOUD = 'Cloud'
}

export interface IFeed {
    _id: Types.ObjectId;
    users: Array<Types.ObjectId>;
    item: Types.ObjectId;
    type: FEED_TYPE;
    createdAt?: Date;
    updatedAt?: Date;
}

export type FeedDocument = Feed & Document & SchemaTimestampsConfig;

export interface GetFeedParams {
    initiatorId: Types.ObjectId;
    cursor?: string;
}