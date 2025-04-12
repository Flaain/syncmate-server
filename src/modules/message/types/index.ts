import { ClientSession, HydratedDocument, Types } from 'mongoose';
import { UserDocument } from 'src/modules/user/types';
import { MessageSendDTO } from '../dtos/message.send.dto';
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

export interface HandleFeedParams {
    conversationId: Types.ObjectId;
    initiatorId: Types.ObjectId;
    recipientId: Types.ObjectId;
    lastActionAt: Date;
    session: ClientSession;
    isNewConversation: boolean;
}

export type MessageDocument = HydratedDocument<Message>;

export type SendMessageParams = MessageSendDTO & { recipientId: string; initiator: UserDocument };
export type EditMessageParams = { message: string; initiator: UserDocument; messageId: string };