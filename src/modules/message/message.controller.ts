import { Body, Controller, Delete, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageSendDTO } from './dtos/message.send.dto';
import { RequestWithUser, Routes } from 'src/utils/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageReplyDTO } from './dtos/message.reply.dto';
import { Throttle } from '@nestjs/throttler';
import { CONVERSATION_EVENTS } from '../conversation/types';
import { defaultSuccessResponse, paramPipe } from 'src/utils/constants';
import { Auth } from '../auth/decorators/auth.decorator';

@Auth()
@Controller(Routes.MESSAGE)
@Throttle({ default: { limit: 50, ttl: 60000 } })
export class MessageController {
    constructor(
        private readonly messageService: MessageService,
        private readonly eventEmitter: EventEmitter2
    ) {}
    
    @Post('send/:recipientId')
    async send(@Req() { doc: { user } }: RequestWithUser, @Body() dto: MessageSendDTO, @Param('recipientId', paramPipe) recipientId: string) {
        const { feedItem, unreadMessages, isNewConversation } = await this.messageService.send({ ...dto, recipientId, initiator: user });

        isNewConversation && this.eventEmitter.emit(CONVERSATION_EVENTS.CREATED, {
            initiatorId: user._id.toString(), 
            recipientId: feedItem.item.recipient._id.toString(),
            conversationId: feedItem.item._id.toString()
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, { 
            feedItem, 
            unreadMessages, 
            initiator: user, 
            session_id: dto.session_id
        });

        return feedItem.item.lastMessage
    }

    @Post('reply/:messageId')
    async reply(@Req() { doc: { user } }: RequestWithUser, @Body() dto: MessageReplyDTO, @Param('messageId', paramPipe) messageId: string) {
        const { feedItem, unreadMessages } = await this.messageService.reply({ ...dto, messageId, initiator: user });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, { unreadMessages, initiator: user, feedItem, session_id: dto.session_id });

        return feedItem.item.lastMessage;
    }

    @Patch('edit/:messageId')
    async edit(@Req() { doc: { user } }: RequestWithUser, @Body() dto: MessageSendDTO, @Param('messageId', paramPipe) messageId: string) {
        const { message, conversationId, isLastMessage, recipientId } = await this.messageService.edit({ messageId, initiator: user, message: dto.message });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_EDIT, { 
            message, 
            isLastMessage,
            conversationId,
            recipientId,
            session_id: dto.session_id,
            initiatorId: user._id.toString(),
        })

        return message;
    }
    
    @Patch('read/:messageId')
    async read(
        @Req() { doc: { user } }: RequestWithUser, 
        @Body() { session_id, recipientId }: Pick<MessageReplyDTO, 'recipientId' | 'session_id'>, 
        @Param('messageId', paramPipe) messageId: string
    ) {
       const { conversationId, readedAt } = await this.messageService.read({ messageId, initiator: user, recipientId });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_READ, {
            conversationId,
            messageId,
            readedAt,
            recipientId,
            session_id,
            initiatorId: user._id.toString()
        });

        return defaultSuccessResponse;
    }

    @Delete('delete/:recipientId')
    async delete(@Req() { doc: { user } }: RequestWithUser, @Param('recipientId', paramPipe) recipientId: string, @Query('messageIds') messageIds: Array<string>) {
        const initiatorId = user._id.toString();
        const data = await this.messageService.delete({ messageIds, recipientId, initiatorId });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_DELETE, { ...data, recipientId, initiatorId });

        return data.findedMessageIds;
    }
}
