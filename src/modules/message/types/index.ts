import { Message } from "../schemas/message.schema"
import { Document, SchemaTimestampsConfig, Types } from 'mongoose';
import { MessageSendDTO } from '../dtos/message.send.dto';
import { MessageDeleteDTO } from '../dtos/message.delete.dto';
import { MessageEditDTO } from '../dtos/message.edit.dto';
import { RequestWithUser } from "src/utils/types";
import { UserDocument } from "src/modules/user/types";

export enum MessageRefPath {
    USER = 'User',
    PARTICIPANT = 'Participant'
}

export interface IMessage {
    _id: Types.ObjectId;
    sender: Types.ObjectId
    hasBeenEdited?: boolean;
    hasBeenRead?: boolean;
    text: string;
    replyTo?: Types.ObjectId;
    replies?: Array<Types.ObjectId>;
    attachments?: Array<Types.ObjectId>;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IMessageService {
    send(params: SendMessageParams): Promise<Message & { conversationId: Types.ObjectId }>;
}

export interface IMessageController {
    send(req: RequestWithUser, dto: MessageSendDTO, recipientId: string): Promise<Message>;
    edit(req: RequestWithUser, dto: MessageEditDTO, messageId: string): Promise<Message>;
}

export type MessageDocument = Message & Document & SchemaTimestampsConfig;

export type SendMessageParams = MessageSendDTO & { recipientId: string; initiator: UserDocument };
export type EditMessageParams = MessageEditDTO & { initiatorId: Types.ObjectId, messageId: string };
export type DeleteMessageParams = MessageDeleteDTO & { initiatorId: Types.ObjectId };