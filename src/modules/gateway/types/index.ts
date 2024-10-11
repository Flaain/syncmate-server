import { Message } from 'src/modules/message/schemas/message.schema';
import { PRESENCE, UserDocument } from 'src/modules/user/types';
import { Socket,  } from 'socket.io';
import { DefaultEventsMap  } from 'socket.io/dist/typed-events';

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

export enum USER_EVENTS {
    PRESENCE = 'user.presence',
    BLOCK = 'user.block',
    UNBLOCK = 'user.unblock',
}

export enum FEED_EVENTS {
    CREATE_MESSAGE = 'feed.create.message',
    EDIT_MESSAGE = 'feed.edit.message',
    DELETE_MESSAGE = 'feed.delete.message',
    CREATE_CONVERSATION = 'feed.create.conversation',
    DELETE_CONVERSATION = 'feed.delete.conversation',
    START_TYPING = 'feed.start.typing',
    STOP_TYPING = 'feed.stop.typing',
    USER_PRESENCE = 'feed.user.presence',
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
    message: Message & { _id: string };
    recipientId: string;
    initiatorId: string;
    conversationId: string;
}

export interface ConversationEditMessageParams extends ConversationSendMessageParams {
    isLastMessage: boolean;
}

export interface ConversationCreateParams {
    initiator: UserDocument;
    conversationId: string;
    recipient: Pick<UserDocument, 'name' | 'email' | '_id'>;
    lastMessageSentAt: Date;
}

export interface ConversationDeleteParams {
    initiatorId: string;
    recipientId: string;
    conversationId: string;
}

export interface ChangeUserStatusParams {
    presence: PRESENCE;
    lastSeenAt?: Date;
}

export interface SocketWithUser extends Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: UserDocument }> {}
