import { OnEvent } from '@nestjs/event-emitter';
import { Socket, Server } from 'socket.io';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer  } from '@nestjs/websockets';
import { SocketWithUser } from '../gateway/types';
import { UserService } from '../user/user.service';
import { getRoomIdByParticipants } from 'src/utils/helpers/getRoomIdByParticipants';
import { GATEWAY_OPTIONS, GatewayService } from '../gateway/gateway.service';
import { FEED_EVENTS } from '../feed/types';
import { ConversationService } from './conversation.service';
import {
    CONVERSATION_EVENTS,
    ConversationCreateParams,
    ConversationDeleteMessageParams,
    ConversationDeleteParams,
    ConversationEditMessageParams,
    ConversationMessageReadParams,
    ConversationSendMessageParams,
} from './types';

@WebSocketGateway(GATEWAY_OPTIONS)
export class ConversationGateway {
    @WebSocketServer()
    readonly server: Server; // we can use attached server or just use from this.gatewayService.server cuz it's the same instance

    constructor(
        private readonly conversationService: ConversationService,
        private readonly userService: UserService,
        private readonly gatewayService: GatewayService,
    ) {}

    @SubscribeMessage(CONVERSATION_EVENTS.JOIN)
    async handleJoinConversation(
        @MessageBody() { recipientId }: { recipientId: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const recipient = await this.userService.findById(recipientId);

            if (!recipient) throw new Error('recipient not found');

            client.join(getRoomIdByParticipants([client.data.user._id.toString(), recipientId]));
        } catch (error) {
            // client.emit(`error`, { error: error.message });
        }
    }

    @SubscribeMessage(CONVERSATION_EVENTS.LEAVE)
    handleLeaveConversation(@MessageBody() { recipientId }: { recipientId: string }, @ConnectedSocket() client: Socket) {
        client.leave(getRoomIdByParticipants([client.data.user._id.toString(), recipientId]));
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_READ)
    onMessageRead({ conversationId, messageId, initiatorId, readedAt, recipientId }: ConversationMessageReadParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_READ, { _id: messageId, readedAt });

        for (let i = 0, sockets = this.gatewayService.sockets.get(initiatorId); i < sockets?.length; i += 1) {
            sockets[i].emit(FEED_EVENTS.UNREAD_COUNTER, { itemId: conversationId, action: 'dec', ctx: 'conversation' });
        }
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_SEND)
    onNewMessage({ initiator, session_id, unread_initiator, unread_recipient, feedItem }: ConversationSendMessageParams) {
        const initiatorId = initiator._id.toString();
        const recipientId = feedItem.item.recipient._id.toString();
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        (this.gatewayService.sockets.get(initiatorId).find((socket) => socket.handshake.query.session_id === session_id) ?? this.server).to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_SEND, feedItem.item.lastMessage);
        
        this.server.to(roomId).emit(CONVERSATION_EVENTS.STOP_TYPING);

        for (let i = 0, sockets = [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)]; i < sockets.length; i += 1) {
            for (let j = 0, s = sockets[i]; j < s?.length; j += 1) {
                const socket = s[j], isInitiator = socket.data.user._id.toString() === initiatorId;

                socket.emit(FEED_EVENTS.CREATE, {
                    ...feedItem,
                    item: {
                        ...feedItem.item,
                        unreadMessages: isInitiator ? unread_initiator : unread_recipient,
                        recipient: isInitiator ? feedItem.item.recipient : this.userService.toRecipient(initiator),
                    },
                });

                !isInitiator && socket.emit(FEED_EVENTS.STOP_TYPING, { _id: feedItem._id, participant: { _id: initiatorId } }); 
            }
        }
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_EDIT)
    onEditMessage({
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

        if (isLastMessage) {
            for (let i = 0, sockets = [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)]; i < sockets.length; i += 1) {
                for (let j = 0, s = sockets[i]; j < s?.length; j += 1) {
                    s[j].emit(FEED_EVENTS.UPDATE, { itemId: conversationId, lastMessage: { text, updatedAt, hasBeenEdited: true } })
                }
            }
        }
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_DELETE)
    handleDeleteMessage({
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
                const socket = s[j];

                isLastMessage && socket.emit(FEED_EVENTS.UPDATE, { itemId: conversationId, lastMessage, lastActionAt: lastMessageSentAt });

                socket.emit(FEED_EVENTS.UNREAD_COUNTER, {
                    action: 'set',
                    itemId: conversationId,
                    ...(socket.data.user._id.toString() === recipientId && { count: unreadMessages }),
                });
            }
        }
    }

    @OnEvent(CONVERSATION_EVENTS.CREATED)
    onConversationCreated({ initiatorId, recipientId, conversationId }: ConversationCreateParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.CREATED, conversationId);
    }

    @OnEvent(CONVERSATION_EVENTS.DELETED)
    onConversationDeleted({ initiatorId, recipientId, conversationId }: ConversationDeleteParams) {
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

    @SubscribeMessage(CONVERSATION_EVENTS.START_TYPING)
    async onStartTyping(
        @MessageBody() { conversationId, recipientId }: { conversationId: string; recipientId: string },
        @ConnectedSocket() client: SocketWithUser,
    ) {
        if (!(await this.conversationService.exists({ _id: conversationId, participants: { $all: [client.data.user._id, recipientId] } }))) return;

        const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.START_TYPING, client.data.user._id.toString());

        for (let i = 0, sockets = this.gatewayService.sockets.get(recipientId); i < sockets?.length; i += 1) {
            const socket = sockets[i];

            !socket.rooms.has(roomId) && socket.emit(FEED_EVENTS.START_TYPING, {
                _id: conversationId,
                participant: { _id: client.data.user._id.toString(), name: client.data.user.name },
            });
        }
    }

    @SubscribeMessage(CONVERSATION_EVENTS.STOP_TYPING)
    onStopTyping(@MessageBody() { recipientId, conversationId }: { conversationId: string; recipientId: string }, @ConnectedSocket() client: SocketWithUser) {
        client.to(getRoomIdByParticipants([client.data.user._id.toString(), recipientId])).emit(CONVERSATION_EVENTS.STOP_TYPING);

        for (let i = 0, sockets = this.gatewayService.sockets.get(recipientId); i < sockets?.length; i += 1) {
            sockets[i].emit(FEED_EVENTS.STOP_TYPING, { _id: conversationId, participant: { _id: client.data.user._id.toString() } });
        }
    }
}