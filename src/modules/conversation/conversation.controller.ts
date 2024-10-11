import { Controller, Delete, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { RequestWithUser, Routes } from 'src/utils/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IConversationController } from './types';
import { AccessGuard } from 'src/utils/guards/access.guard';
import { CONVERSATION_EVENTS } from '../gateway/types';

@Controller(Routes.CONVERSATION)
export class ConversationController implements IConversationController {
    constructor(
        private readonly conversationService: ConversationService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    @Delete('delete/:id')
    @UseGuards(AccessGuard)
    async delete(@Req() req: RequestWithUser, @Param('id') id: string) {
        const { _id, recipientId } = await this.conversationService.deleteConversation({ initiatorId: req.user.doc._id, recipientId: id });
        
        this.eventEmitter.emit(CONVERSATION_EVENTS.DELETED, { 
            recipientId,
            initiatorId: req.user.doc._id.toString(), 
            conversationId: _id.toString()
        });

        return { conversationId: _id };
    }

    @Get(':id')
    @UseGuards(AccessGuard)
    getConversation(@Req() req: RequestWithUser, @Param('id') id: string) {
        return this.conversationService.getConversation({ initiator: req.user.doc, recipientId: id });
    }

    @Get("previous-messages/:id")
    @UseGuards(AccessGuard)
    getPreviousMessages(@Req() req: RequestWithUser, @Param('id') id: string, @Query('cursor') cursor: string) {
        return this.conversationService.getPreviousMessages({ recipientId: id, cursor, initiator: req.user.doc })
    }
}