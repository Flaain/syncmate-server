import { Controller, Delete, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { RequestWithUser, Routes } from 'src/utils/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccessGuard } from '../auth/guards/auth.access.guard';
import { CONVERSATION_EVENTS } from './types';

@Controller(Routes.CONVERSATION)
@UseGuards(AccessGuard)
export class ConversationController {
    constructor(
        private readonly conversationService: ConversationService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    @Delete('delete/:id')
    async delete(@Req() req: RequestWithUser, @Param('id') id: string) {
        const { _id, recipientId } = await this.conversationService.deleteConversation({ initiatorId: req.doc.user._id, recipientId: id });
        
        this.eventEmitter.emit(CONVERSATION_EVENTS.DELETED, { 
            recipientId,
            initiatorId: req.doc.user._id.toString(), 
            conversationId: _id.toString()
        });

        return { conversationId: _id };
    }

    @Get(':id')
    getConversation(@Req() req: RequestWithUser, @Param('id') id: string) {
        return this.conversationService.getConversation({ initiator: req.doc.user, recipientId: id });
    }

    @Get("previous-messages/:id")
    getPreviousMessages(@Req() req: RequestWithUser, @Param('id') id: string, @Query('cursor') cursor: string) {
        return this.conversationService.getPreviousMessages({ recipientId: id, cursor, initiator: req.doc.user })
    }
}