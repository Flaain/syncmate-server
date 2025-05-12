import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { getRoomIdByParticipants } from 'src/utils/helpers/getRoomIdByParticipants';
import { FEED_EVENTS, FEED_TYPE, LAYOUT_EVENTS } from '../feed/types';
import { GATEWAY_OPTIONS, GatewayService } from '../gateway/gateway.service';
import { UserService } from '../user/user.service';
import {
    CONVERSATION_EVENTS,
    ConversationCreateParams,
    ConversationDeleteMessageParams,
    ConversationDeleteParams,
    ConversationEditMessageParams,
    ConversationMessageReadParams,
    ConversationSendMessageParams,
    ConversationTypingParams
} from './types';
import { AppException } from 'src/utils/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { SocketWithUser } from '../gateway/types';
import { conversationTypingSchema } from './schemas/conversation.typing.schema';
import { conversationRecipientSchema } from './schemas/conversation.recipient.schema';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway(GATEWAY_OPTIONS)
export class ConversationGateway {
    @WebSocketServer()
    readonly server: Server;

    constructor(private readonly userService: UserService, private readonly gatewayService: GatewayService) {}

    @SubscribeMessage(CONVERSATION_EVENTS.JOIN)
    async onJoin(@MessageBody() dto: { recipientId: string }, @ConnectedSocket() client: SocketWithUser) {
        const { recipientId } = conversationRecipientSchema.parse(dto);

        if (!(await this.userService.findById(recipientId))) throw new AppException({ message: 'recipient not found' }, HttpStatus.NOT_FOUND);

        client.join(getRoomIdByParticipants([client.data.user._id.toString(), recipientId]));
    }

    @SubscribeMessage(CONVERSATION_EVENTS.LEAVE)
    onLeave(@MessageBody() dto: { recipientId: string }, @ConnectedSocket() client: SocketWithUser) {
        const { recipientId } = conversationRecipientSchema.parse(dto);

        client.leave(getRoomIdByParticipants([client.data.user._id.toString(), recipientId]));
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_READ)
    onMessageRead({ conversationId, messageId, initiatorId, readedAt, recipientId }: ConversationMessageReadParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_READ, { _id: messageId, readedAt });

        for (let i = 0, sockets = this.gatewayService.sockets.get(initiatorId); i < sockets?.length; i += 1) {
            sockets[i].emit(FEED_EVENTS.UNREAD_COUNTER, { itemId: conversationId, action: 'dec', ctx: FEED_TYPE.CONVERSATION });
        }
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_SEND)
    onMessageSend({ initiator, session_id, unread_initiator, unread_recipient, feedItem }: ConversationSendMessageParams) {
        const initiatorId = initiator._id.toString();
        const recipientId = feedItem.item.recipient._id.toString();
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        (this.gatewayService.sockets.get(initiatorId).find((socket) => socket.handshake.query.session_id === session_id) ?? this.server).to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_SEND, feedItem.item.lastMessage);
        
        this.server.to(roomId).emit(CONVERSATION_EVENTS.TYPING_STOP);

        for (let i = 0, sockets = [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)]; i < sockets.length; i += 1) {
            for (let j = 0, s = sockets[i]; j < s?.length; j += 1) {
                const socket = s[j], isInitiator = socket.data.user._id.toString() === initiatorId;

                socket.emit(FEED_EVENTS.CREATE, {
                    ...feedItem,
                    item: {
                        ...feedItem.item,
                        ...(!isInitiator && { participantsTyping: [] }), // reset typing status for recipient sockets
                        unreadMessages: isInitiator ? unread_initiator : unread_recipient,
                        recipient: isInitiator ? feedItem.item.recipient : this.userService.toRecipient(initiator),
                    },
                }, !socket.rooms.has(roomId) && !isInitiator);
            }
        }
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_EDIT)
    onMessageEdit({
        _id,
        isLastMessage,
        conversationId,
        initiatorId,
        session_id,
        text,
        updatedAt,
        recipientId,
    }: ConversationEditMessageParams) {
        (this.gatewayService.sockets.get(initiatorId).find((socket) => socket.handshake.query.session_id === session_id) ?? this.server).to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_EDIT, { _id, text, updatedAt });
        
        for (let i = 0, sockets = [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)]; i < sockets.length; i += 1) {
            for (let j = 0, s = sockets[i]; j < s?.length; j += 1) {
                const socket = s[j];

                socket.emit(LAYOUT_EVENTS.UPDATE_DRAFT, { 
                    _id,
                    text,
                    updatedAt,
                    type: 'edit',
                    recipientId: socket.data.user._id.toString() === initiatorId ? recipientId : initiatorId
                });

                isLastMessage && s[j].emit(FEED_EVENTS.UPDATE, { itemId: conversationId, lastMessage: { text, updatedAt, hasBeenEdited: true } });
            }
        }
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_DELETE)
    onMessageDelete({
        initiatorId,
        recipientId,
        unreadMessages,
        conversationId,
        findedMessageIds,
        lastMessage,
        lastMessageSentAt,
        isLastMessage,
    }: ConversationDeleteMessageParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_DELETE, findedMessageIds);

        for (let i = 0, sockets = [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)]; i < sockets.length; i += 1) {
            for (let j = 0, s = sockets[i]; j < s?.length; j += 1) {
                const socket = s[j], isInitiator = socket.data.user._id.toString() === initiatorId;

                socket.emit(LAYOUT_EVENTS.UPDATE_DRAFT, { 
                    messageIds: findedMessageIds, 
                    recipientId: isInitiator ? recipientId : initiatorId, 
                    type: 'delete' 
                });

                isLastMessage && socket.emit(FEED_EVENTS.UPDATE, { 
                    lastMessage, 
                    itemId: conversationId,
                    lastActionAt: lastMessageSentAt, 
                    shouldSort: true 
                });

                !isInitiator && socket.emit(FEED_EVENTS.UNREAD_COUNTER, { action: 'set', itemId: conversationId, count: unreadMessages });
            }
        }
    }

    @OnEvent(CONVERSATION_EVENTS.CREATED)
    onCreate({ initiatorId, recipientId, conversationId }: ConversationCreateParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.CREATED, conversationId);
    }

    @OnEvent(CONVERSATION_EVENTS.DELETED)
    onDelete({ initiatorId, recipientId, conversationId }: ConversationDeleteParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.DELETED);

        for (let i = 0, sockets = [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)]; i < sockets.length; i += 1) {
            for (let j = 0, s = sockets[i]; j < s?.length; j += 1) s[j].emit(FEED_EVENTS.DELETE, conversationId);
        }
    }

    @OnEvent(CONVERSATION_EVENTS.USER_BLOCK)
    onBlock({ initiatorId, recipientId }: { initiatorId: string; recipientId: string }) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.USER_BLOCK, recipientId);
    }

    @OnEvent(CONVERSATION_EVENTS.USER_UNBLOCK)
    onUnblock({ initiatorId, recipientId }: { initiatorId: string; recipientId: string }) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.USER_UNBLOCK, recipientId);
    }

    @SubscribeMessage(CONVERSATION_EVENTS.TYPING_START)
    onTypingStart(@MessageBody() dto: ConversationTypingParams, @ConnectedSocket() client: SocketWithUser) {
        // if (!(await this.conversationService.exists({ _id: conversationId, participants: { $all: [client.data.user._id, recipientId] } }))) return;
        const { recipientId, conversationId } = conversationTypingSchema.parse(dto);
        
        const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.TYPING_START, client.data.user._id.toString());

        for (let i = 0, sockets = this.gatewayService.sockets.get(recipientId); i < sockets?.length; i += 1) {
            const socket = sockets[i];

            !socket.rooms.has(roomId) && socket.emit(FEED_EVENTS.START_TYPING, {
                _id: conversationId,
                participant: { _id: client.data.user._id.toString(), name: client.data.user.name },
            });
        }
    }

    @SubscribeMessage(CONVERSATION_EVENTS.TYPING_STOP)
    onTypingStop(@MessageBody() dto: ConversationTypingParams, @ConnectedSocket() client: SocketWithUser) {
        const { recipientId, conversationId } = conversationTypingSchema.parse(dto);
        
        const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);
        
        client.to(roomId).emit(CONVERSATION_EVENTS.TYPING_STOP);

        for (let i = 0, sockets = this.gatewayService.sockets.get(recipientId); i < sockets?.length; i += 1) {
            const socket = sockets[i];

            !socket.rooms.has(roomId) && socket.emit(FEED_EVENTS.STOP_TYPING, {
                _id: conversationId,
                participant: { _id: client.data.user._id.toString() },
            });
        }
    }
}