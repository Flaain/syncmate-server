import { Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { RequestWithUser, Routes } from 'src/utils/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CONVERSATION_EVENTS, MessageEditDTO, MessageReadDTO, MessageReplyDTO, MessageSendDTO } from './types';
import { defaultSuccessResponse, paramPipe } from 'src/utils/constants';
import { Throttle } from '@nestjs/throttler';
import { DTO } from 'src/utils/decorators/dto.decorator';
import { messageEditSchema } from './schemas/conversation.message.edit.schema';
import { messageSendSchema } from './schemas/conversation.message.send.schema';
import { messageReplySchema } from './schemas/conversation.message.reply.schema';
import { messageReadSchema } from './schemas/conversation.message.read.schema';

@Controller(Routes.CONVERSATION)
export class ConversationController {
    constructor(
        private readonly conversationService: ConversationService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    @Get(':id')
    getConversation(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        return this.conversationService.getConversation({ initiator: req.doc.user, recipientId: id });
    }

    @Delete('delete/:id')
    async delete(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        const { _id, recipientId } = await this.conversationService.deleteConversation({
            initiatorId: req.doc.user._id,
            recipientId: id,
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.DELETED, {
            recipientId,
            initiatorId: req.doc.user._id.toString(),
            conversationId: _id.toString(),
        });

        return { conversationId: _id };
    }

    @Post('message/send/:recipientId')
    @Throttle({ default: { limit: 100, ttl: 60000 } })
    async send(
        @Req() { doc: { user } }: RequestWithUser,
        @DTO(messageSendSchema) dto: MessageSendDTO,
        @Param('recipientId', paramPipe) recipientId: string,
    ) {
        const { feedItem, unread_initiator, initiatorAsRecipient, unread_recipient, isNewConversation } = await this.conversationService.onMessageSend({
            ...dto,
            recipientId,
            initiator: user,
        });

        isNewConversation && this.eventEmitter.emit(CONVERSATION_EVENTS.CREATED, {
            initiatorId: user._id.toString(),
            recipientId: feedItem.item.recipient._id.toString(),
            conversationId: feedItem.item._id.toString(),
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, { 
            feedItem,
            initiatorAsRecipient,
            unread_initiator,
            unread_recipient,
            session_id: dto.session_id,
        });

        return feedItem.item.lastMessage;
    }

    @Post('message/reply/:messageId')
    async reply(
        @Req() { doc: { user } }: RequestWithUser,
        @DTO(messageReplySchema) dto: MessageReplyDTO,
        @Param('messageId', paramPipe) messageId: string,
    ) {
        const { feedItem, unread_initiator, initiatorAsRecipient, unread_recipient } = await this.conversationService.onMessageReply({ 
            ...dto, 
            messageId, 
            initiator: user 
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, {
            feedItem,
            unread_initiator,
            unread_recipient,
            initiatorAsRecipient,
            session_id: dto.session_id,
        });

        return feedItem.item.lastMessage;
    }

    @Patch('message/edit/:messageId')
    async edit(
        @Req() { doc: { user } }: RequestWithUser,
        @DTO(messageEditSchema) dto: MessageEditDTO,
        @Param('messageId', paramPipe) messageId: string,
    ) {
        const { message, conversationId, isLastMessage, recipientId } = await this.conversationService.onMessageEdit({
            messageId,
            initiator: user,
            recipientId: dto.recipientId,
            message: dto.message,
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_EDIT, {
            _id: message._id,
            text: message.text,
            updatedAt: message.updatedAt,
            isLastMessage,
            conversationId,
            recipientId,
            session_id: dto.session_id,
            initiatorId: user._id.toString(),
        });

        return message;
    }

    @Patch('message/read/:messageId')
    async read(
        @Req() { doc: { user } }: RequestWithUser,
        @DTO(messageReadSchema) { recipientId }: MessageReadDTO,
        @Param('messageId', paramPipe) messageId: string,
    ) {
        const { conversationId, readedAt } = await this.conversationService.onMessageRead({
            messageId,
            initiator: user,
            recipientId,
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_READ, {
            conversationId,
            messageId,
            readedAt,
            recipientId,
            initiatorId: user._id.toString(),
        });

        return defaultSuccessResponse;
    }

    @Delete('message/delete/:recipientId')
    async deleteMessage(
        @Req() { doc: { user } }: RequestWithUser,
        @Param('recipientId', paramPipe) recipientId: string,
        @Query('messageIds') messageIds: Array<string>,
    ) {
        const initiatorId = user._id.toString();
        const data = await this.conversationService.onMessageDelete({ messageIds, recipientId, initiatorId });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_DELETE, { ...data, recipientId, initiatorId });

        return data.findedMessageIds;
    }

    @Get('previous-messages/:id')
    getPreviousMessages(
        @Req() req: RequestWithUser,
        @Param('id', paramPipe) id: string,
        @Query('cursor', paramPipe) cursor: string,
    ) {
        return this.conversationService.getPreviousMessages({ recipientId: id, cursor, initiator: req.doc.user });
    }
}