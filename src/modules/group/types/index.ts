import { Document, SchemaTimestampsConfig, Types } from 'mongoose';

export interface IGroup {
    login: string;
    participants?: Array<Types.ObjectId>;
    messages?: Array<Types.ObjectId>;
    owner: Types.ObjectId;
    name: string;
    isPrivate?: boolean;
    isOfficial?: boolean;
    lastMessage?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
    lastMessageSentAt?: Date;
}

export enum GroupView {
    PARTICIPANT = 'participant',
    REQUEST = 'request',
    JOIN = 'join',
    GUEST = 'guest',
}

export type GroupDocument = IGroup & Document & SchemaTimestampsConfig;