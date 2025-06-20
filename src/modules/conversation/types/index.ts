import { ClientSession, HydratedDocument, Types } from 'mongoose';
import { ConversationFeed, FeedWrapper } from 'src/modules/feed/types';
import { Message } from 'src/modules/message/schemas/message.schema';
import { User } from 'src/modules/user/schemas/user.schema';
import { UserDocument } from 'src/modules/user/types';
import { Conversation } from '../schemas/conversation.schema';
import { ConversationSettings } from '../schemas/conversation.settings.schema';
import { MessageSendDTO } from '../dtos/message.send.dto';

export type ConversationDocument = HydratedDocument<Conversation>;
export type ConversationSettingsDocument = HydratedDocument<ConversationSettings>;
export type SendMessageParams = MessageSendDTO & { recipientId: string; initiator: UserDocument };
export type EditMessageParams = { message: string; initiator: UserDocument; messageId: string };

export enum CONVERSATION_EVENTS {
    JOIN = 'conversation.join',
    LEAVE = 'conversation.leave',
    MESSAGE_READ = 'conversation.message.read',
    MESSAGE_SEND = 'conversation.message.send',
    MESSAGE_EDIT = 'conversation.message.edit',
    MESSAGE_DELETE = 'conversation.message.delete',
    CREATED = 'conversation.created',
    DELETED = 'conversation.deleted',
    USER_PRESENCE = 'conversation.user.presence',
    USER_BLOCK = 'conversation.user.block',
    USER_UNBLOCK = 'conversation.user.unblock',
    TYPING_START = 'conversation.typing.start',
    TYPING_STOP = 'conversation.typing.stop',
}

export interface ConversationTypingParams {
    conversationId: string;
    recipientId: string;
}

export interface ConversationDeleteMessageParams {
    findedMessageIds: Array<string>;
    conversationId: string;
    unreadMessages: number;
    initiatorId: string;
    recipientId: string;
    isLastMessage: boolean;
    lastMessage: Message;
    lastMessageSentAt: Date;
}

export interface ConversationSendMessageParams {
    initiatorAsRecipient: any;
    feedItem: FeedWrapper<ConversationFeed>;
    session_id: string;
    unread_initiator: number;
    unread_recipient: number;
}

export interface ConversationEditMessageParams {
    _id: string;
    text: string;
    updatedAt: Date;
    isLastMessage: boolean;
    conversationId: string;
    recipientId: string;
    initiatorId: string;
    session_id: string;
}

export interface ConversationMessageReadParams {
    conversationId: string;
    readedAt: string;
    messageId: string;
    initiatorId: string;
    recipientId: string;
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

export interface HandleFeedParams {
    conversationId: Types.ObjectId;
    initiatorId: Types.ObjectId;
    recipientId: Types.ObjectId;
    lastActionAt: Date;
    session: ClientSession;
    isNewConversation: boolean;
}