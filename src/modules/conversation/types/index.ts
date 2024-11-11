import { HydratedDocument, Types } from 'mongoose';
import { Conversation } from '../schemas/conversation.schema';
import { User } from 'src/modules/user/schemas/user.schema';
import { Message } from 'src/modules/message/schemas/message.schema';
import { UserDocument } from 'src/modules/user/types';
import { ConversationFeed, FeedWrapper } from 'src/modules/feed/types';

export enum CONVERSATION_EVENTS {
    JOIN = 'conversation.join',
    LEAVE = 'conversation.leave',
    MESSAGE_SEND = 'conversation.message.send',
    MESSAGE_EDIT = 'conversation.message.edit',
    MESSAGE_DELETE = 'conversation.message.delete',
    CREATED = 'conversation.created',
    DELETED = 'conversation.deleted',
    PRESENCE = 'conversation.user.presence',
    USER_BLOCK = 'conversation.user.block',
    USER_UNBLOCK = 'conversation.user.unblock',
    START_TYPING = 'conversation.start.typing',
    STOP_TYPING = 'conversation.stop.typing',
}

export interface ConversationDeleteMessageParams {
    messageIds: Array<string>;
    conversationId: string;
    initiatorId: string;
    recipientId: string;
    isLastMessage: boolean;
    lastMessage: Message;
    lastMessageSentAt: Date;
}

export interface ConversationSendMessageParams {
    initiator: UserDocument;
    feedItem: FeedWrapper<ConversationFeed>;
}

export interface ConversationEditMessageParams {
    message: Message;
    isLastMessage: boolean;
    conversationId: string;
    recipientId: string;
    initiatorId: string;
}

export interface ConversationCreateParams {
    initiatorId: string;
    recipientId: string;
    conversationId: string;
}

export interface ConversationDeleteParams {
    initiatorId: string;
    recipientId: string;
    conversationId: string;
}

export interface IConversation {
    _id: Types.ObjectId;
    lastMessageSentAt?: Date;
    lastMessage?: Types.ObjectId;
    participants: Array<Types.ObjectId>;
    messages?: Array<Types.ObjectId>;
}

export type ConversationDocument = HydratedDocument<Conversation>;

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