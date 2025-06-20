import { HydratedDocument, Types } from 'mongoose';
import { Message } from '../schemas/message.schema';

export enum MessageSourceRefPath {
    CONVERSATION = 'Conversation',
    GROUP = 'Group',
}

export interface IMessage {
    _id: Types.ObjectId;
    sender: Types.ObjectId;
    hasBeenEdited?: boolean;
    read_by?: Array<any>;
    text: string;
    replyTo?: Types.ObjectId;
    replies?: Array<Types.ObjectId>;
    attachments?: Array<Types.ObjectId>;
    createdAt?: Date;
    updatedAt?: Date;
}

export type MessageDocument = HydratedDocument<Message>;