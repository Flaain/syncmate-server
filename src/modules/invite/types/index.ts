import { Document, SchemaTimestampsConfig, Types } from 'mongoose';
import { Invite } from '../schema/invite.schema';

export interface InviteInterface {
    code: string;
    groupId: Types.ObjectId;
    createdBy: Types.ObjectId;
    createdAt: Date;
    expiresAt: Date;
}

export type InviteDocument = Invite & Document & SchemaTimestampsConfig;