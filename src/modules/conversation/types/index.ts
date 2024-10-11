import { Document, SchemaTimestampsConfig, Types } from 'mongoose';
import { ConversationCreateDTO } from '../dtos/conversation.create.dto';
import { Conversation } from '../schemas/conversation.schema';
import { RequestWithUser } from 'src/utils/types';
import { UserDocument } from 'src/modules/user/types';
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

export type ConversationDocument = Conversation & Document & SchemaTimestampsConfig;

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

export interface IConversationService {
    getConversation: (params: {
        initiator: UserDocument;
        recipientId: string;
        cursor?: string;
    }) => Promise<GetConversationReturn>;
    deleteConversation: (params: {
        initiatorId: Types.ObjectId;
        recipientId: string;
    }) => Promise<{ _id: Types.ObjectId; recipientId: string }>;
}

export interface IConversationController {
    delete: (req: RequestWithUser, id: string) => Promise<{ conversationId: Types.ObjectId }>;
    getConversation(req: RequestWithUser, recipientId: string, cursor?: string): Promise<GetConversationReturn>;
}
