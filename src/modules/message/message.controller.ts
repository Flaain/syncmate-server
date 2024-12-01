import { Body, Controller, Delete, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageSendDTO } from './dtos/message.send.dto';
import { RequestWithUser, Routes } from 'src/utils/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageReplyDTO } from './dtos/message.reply.dto';
import { Throttle } from '@nestjs/throttler';
import { AccessGuard } from '../auth/guards/auth.access.guard';
import { CONVERSATION_EVENTS } from '../conversation/types';
import { paramPipe } from 'src/utils/constants';

@Throttle({ default: { limit: 50, ttl: 60000 } })
@Controller(Routes.MESSAGE)
@UseGuards(AccessGuard)
export class MessageController {
    constructor(
        private readonly messageService: MessageService,
        private readonly eventEmitter: EventEmitter2
    ) {}
    
    @Post('send/:recipientId')
    async send(@Req() { doc: { user } }: RequestWithUser, @Body() dto: MessageSendDTO, @Param('recipientId', paramPipe) recipientId: string) {
        const { feedItem, isNewConversation } = await this.messageService.send({ ...dto, recipientId, initiator: user });
        
        isNewConversation && this.eventEmitter.emit(CONVERSATION_EVENTS.CREATED, {
            initiatorId: user._id.toString(), 
            recipientId: feedItem.item.recipient._id.toString(),
            conversationId: feedItem.item._id.toString()
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, { initiator: user, initiatorSocketId: dto.socket_id, feedItem });

        return feedItem.item.lastMessage;
    }

    @Post('reply/:messageId')
    async reply(@Req() { doc: { user } }: RequestWithUser, @Body() dto: MessageReplyDTO, @Param('messageId', paramPipe) messageId: string) {
        const feedItem = await this.messageService.reply({ ...dto, messageId, initiator: user });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, { initiator: user, feedItem, initiatorSocketId: dto.socket_id });

        return feedItem.item.lastMessage;
    }

    @Patch('edit/:messageId')
    async edit(@Req() {doc: { user } }: RequestWithUser, @Body() dto: MessageSendDTO, @Param('messageId', paramPipe) messageId: string) {
        const { message, conversationId, isLastMessage, recipientId } = await this.messageService.edit({ messageId, initiator: user, message: dto.message });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_EDIT, { 
            message, 
            isLastMessage,
            conversationId,
            recipientId,
            initiatorSocketId: dto.socket_id,
            initiatorId: user._id.toString(),
        })

        return message;
    }

    @Delete('delete/:recipientId')
    async delete(@Req() { doc: { user } }: RequestWithUser, @Param('recipientId', paramPipe) recipientId: string, @Query('messageIds') messageIds: Array<string>) {
        const initiatorId = user._id.toString();
        const data = await this.messageService.delete({ messageIds, recipientId, initiatorId });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_DELETE, { ...data, recipientId, initiatorId });

        return data.findedMessageIds;
    }
}
