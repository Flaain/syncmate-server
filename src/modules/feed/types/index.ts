import { Document, PopulateOptions, SchemaTimestampsConfig } from 'mongoose';
import { Types } from 'mongoose';
import { Feed } from '../schemas/feed.schema';
import { S3Client } from '@aws-sdk/client-s3';

export enum FEED_TYPE {
    CONVERSATION = 'Conversation',
    GROUP = 'Group',
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

export interface FeedHandlers {
    populate: (initiatorId: Types.ObjectId) => PopulateOptions;
    canPreSignUrl: (item: any) => boolean;
    getPreSignedUrl: (item: any, client: S3Client) => Promise<string>;
    returnObject: <T>(item: any, url?: string) => T;
}
