import { HydratedDocument, Types } from 'mongoose';
import { Conversation } from '../schemas/conversation.schema';
import { User } from 'src/modules/user/schemas/user.schema';

export enum CONVERSATION_HEALTH {
    BLOCKED_BY_INITIATOR = 'BLOCKED_BY_INITIATOR',
    BLOCKED_BY_RECIPIENT = 'BLOCKED_BY_RECIPIENT',
    RECIPIENT_PREMIUM_ONLY = 'RECIPIENT_PREMIUM_ONLY',
}

export interface IConversation {
    _id: Types.ObjectId;
    lastMessageSentAt?: Date;
    lastMessage?: Types.ObjectId;
    participants: Array<Types.ObjectId>;
    messages?: Array<Types.ObjectId>;
}

export type ConversationDocument = HydratedDocument<Conversation>

export interface GetConversationReturn {
    conversation: {
        _id?: Types.ObjectId;
        messages: Array<Types.ObjectId>;
        recipient: Omit<User, 'password' | 'birthDate'>;
    };
    nextCursor: string | null;
}

export interface CreateConversationReturn {
    _id: Types.ObjectId;
    lastMessageSentAt: Date;
    recipient: Omit<User, 'password' | 'birthDate'>;
}
