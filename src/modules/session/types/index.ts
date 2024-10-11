import mongoose, { SchemaTimestampsConfig, Types } from 'mongoose';
import { Session } from '../schemas/session.schema';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document & SchemaTimestampsConfig;

export interface ISession {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    userAgent?: string;
    createdAt?: Date;
    expiresAt?: Date;
}

export interface DropSessionParams {
    initiatorUserId: Types.ObjectId | string;
    initiatorSessionId: string;
    sessionId: string;
}