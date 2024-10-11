import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageSendDTO } from './dtos/message.send.dto';
import { RequestWithUser, Routes } from 'src/utils/types';
import { MessageDeleteDTO } from './dtos/message.delete.dto';
import { MessageEditDTO } from './dtos/message.edit.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IMessageController } from './types';
import { AccessGuard } from 'src/utils/guards/access.guard';
import { MessageReplyDTO } from './dtos/message.reply.dto';
import { Throttle } from '@nestjs/throttler';
import { CONVERSATION_EVENTS } from '../gateway/types';

@Throttle({ default: { limit: 50, ttl: 60000 } })
@Controller(Routes.MESSAGE)
export class MessageController implements IMessageController {
    constructor(
        private readonly messageService: MessageService,
        private readonly eventEmitter: EventEmitter2
    ) {}
    
    @Post('send/:recipientId')
    @UseGuards(AccessGuard)
    async send(@Req() req: RequestWithUser, @Body() dto: MessageSendDTO, @Param('recipientId') recipientId: string) {
        const { recipient, message, conversation, isNewConversation } = await this.messageService.send({ ...dto, recipientId, initiator: req.user.doc });

       isNewConversation && this.eventEmitter.emit(CONVERSATION_EVENTS.CREATED, {
            recipient: recipient.toObject(),
            initiator: req.user.doc,
            conversationId: conversation._id,
            lastMessageSentAt: conversation.lastMessageSentAt,
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, {
            message,
            recipientId,
            conversationId: conversation._id,
            initiatorId: req.user.doc._id.toString()
        });

        return message;
    }

    @Post('reply/:messageId')
    @UseGuards(AccessGuard)
    async reply(@Req() req: RequestWithUser, @Body() dto: MessageReplyDTO, @Param('messageId') messageId: string) {
        const { message, conversationId } = await this.messageService.reply({ ...dto, messageId, initiator: req.user.doc });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, {
            message,
            recipientId: dto.recipientId,
            conversationId,
            initiatorId: req.user.doc._id.toString(),
        })

        return message;
    }

    @Patch('edit/:messageId')
    @UseGuards(AccessGuard)
    async edit(@Req() req: RequestWithUser, @Body() dto: MessageEditDTO, @Param('messageId') messageId: string) {
        const { message, conversationId, isLastMessage } = await this.messageService.edit({ ...dto, messageId, initiatorId: req.user.doc._id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_EDIT, { 
            message, 
            isLastMessage,
            conversationId,
            recipientId: dto.recipientId,
            initiatorId: req.user.doc._id.toString(),
        })

        return message;
    }

    @Delete('delete')
    @UseGuards(AccessGuard)
    async delete(@Req() req: RequestWithUser, @Body() dto: MessageDeleteDTO) {
        const { conversationId, findedMessageIds, ...message } = await this.messageService.delete({ ...dto, initiatorId: req.user.doc._id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_DELETE, { 
            ...message,
            recipientId: dto.recipientId,
            messageIds: findedMessageIds,
            conversationId, 
            initiatorId: req.user.doc._id.toString() 
        })

        return message;
    }
}
