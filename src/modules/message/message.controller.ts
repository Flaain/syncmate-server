import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageSendDTO } from './dtos/message.send.dto';
import { RequestWithUser, Routes } from 'src/utils/types';
import { MessageDeleteDTO } from './dtos/message.delete.dto';
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
    async send(@Req() req: RequestWithUser, @Body() dto: MessageSendDTO, @Param('recipientId', paramPipe) recipientId: string) {
        const { feedItem, isNewConversation } = await this.messageService.send({ ...dto, recipientId, initiator: req.doc.user });
        
        isNewConversation && this.eventEmitter.emit(CONVERSATION_EVENTS.CREATED, {
            initiatorId: req.doc.user._id.toString(), 
            recipientId: feedItem.item.recipient._id.toString(),
            conversationId: feedItem.item._id.toString()
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, { initiator: req.doc.user, feedItem });

        return feedItem.item.lastMessage;
    }

    @Post('reply/:messageId')
    async reply(@Req() req: RequestWithUser, @Body() dto: MessageReplyDTO, @Param('messageId', paramPipe) messageId: string) {
        const { feedItem } = await this.messageService.reply({ ...dto, messageId, initiator: req.doc.user });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_SEND, { initiator: req.doc.user, feedItem })

        return feedItem.item.lastMessage;
    }

    @Patch('edit/:messageId')
    async edit(@Req() req: RequestWithUser, @Body() dto: MessageSendDTO, @Param('messageId', paramPipe) messageId: string) {
        const { message, conversationId, isLastMessage, recipientId } = await this.messageService.edit({
            messageId,
            initiatorId: req.doc.user._id,
            message: dto.message,
        });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_EDIT, { 
            message, 
            isLastMessage,
            conversationId,
            recipientId,
            initiatorId: req.doc.user._id.toString(),
        })

        return message;
    }

    @Delete('delete')
    async delete(@Req() req: RequestWithUser, @Body() dto: MessageDeleteDTO) {
        const { conversationId, findedMessageIds, ...message } = await this.messageService.delete({ ...dto, initiatorId: req.doc.user._id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.MESSAGE_DELETE, { 
            ...message,
            recipientId: dto.recipientId,
            messageIds: findedMessageIds,
            conversationId, 
            initiatorId: req.doc.user._id.toString() 
        })

        return message;
    }
}
