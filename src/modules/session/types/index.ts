import mongoose, { HydratedDocument, SchemaTimestampsConfig, Types } from 'mongoose';
import { Session } from '../schemas/session.schema';

export type SessionDocument = HydratedDocument<Session> & SchemaTimestampsConfig;

export interface ISession {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    userAgent?: string;
    createdAt?: Date;
    expiresAt?: Date;
}

export interface DropSessionParams {
    initiatorUserId: Types.ObjectId | string;
    initiatorSessionId: Types.ObjectId;
    sessionId: string;
}