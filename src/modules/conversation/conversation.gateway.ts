import { Injectable } from "@nestjs/common";
import { Socket } from "socket.io";
import { GatewayService } from "../gateway/gateway.service";
import { SocketWithUser } from "../gateway/types";
import { ConnectedSocket, MessageBody, SubscribeMessage } from "@nestjs/websockets";
import { OnEvent } from "@nestjs/event-emitter";
import { UserService } from "../user/user.service";
import { ConversationService } from "./conversation.service";
import { 
    CONVERSATION_EVENTS, 
    ConversationCreateParams, 
    ConversationDeleteMessageParams, 
    ConversationDeleteParams, 
    ConversationEditMessageParams, 
    ConversationSendMessageParams 
} from "./types";
import { toRecipient } from "./utils/toRecipient";
import { getRoomIdByParticipants } from "src/utils/helpers/getRoomIdByParticipants";
import { FEED_EVENTS } from "../feed/types";

@Injectable()
export class ConversationGateway {
    constructor(
        private readonly gatewayService: GatewayService,
        private readonly userService: UserService,
        private readonly conversationService: ConversationService
    ) {}

    @SubscribeMessage(CONVERSATION_EVENTS.JOIN)
    async handleJoinConversation(@MessageBody() { recipientId }: { recipientId: string }, @ConnectedSocket() client: Socket) {
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

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_SEND)
    onNewMessage({ initiator, feedItem }: ConversationSendMessageParams) {
        const initiatorId = initiator._id.toString();
        const recipientId = feedItem.item.recipient._id.toString();
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        this.gatewayService.server.to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_SEND, feedItem.item.lastMessage);
        this.gatewayService.server.to(roomId).emit(CONVERSATION_EVENTS.STOP_TYPING);
        
        [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)].forEach((sockets) => {
            sockets?.forEach((socket) => {
                socket.emit(FEED_EVENTS.CREATE, { 
                    ...feedItem, 
                    item: { 
                        ...feedItem.item,
                        recipient: socket.data.user._id.toString() === initiatorId ? feedItem.item.recipient : toRecipient(initiator.toObject())
                    } 
                });
    
                socket.data.user._id.toString() === recipientId && socket.emit(FEED_EVENTS.STOP_TYPING, {
                    _id: feedItem._id,
                    participant: { _id: initiatorId },
                });
            })
        })
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_EDIT)
    onEditMessage({ isLastMessage, conversationId, initiatorId, message, recipientId }: ConversationEditMessageParams) {
        this.gatewayService.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_EDIT, message);
        
        isLastMessage && [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.UPDATE, { itemId: conversationId, lastMessage: message }));
        })
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_DELETE)
    handleDeleteMessage({ initiatorId, recipientId, conversationId, messageIds, lastMessage, lastMessageSentAt, isLastMessage }: ConversationDeleteMessageParams) {
        this.gatewayService.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_DELETE, messageIds);
        
        isLastMessage && [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.UPDATE, { itemId: conversationId, lastMessage, lastActionAt: lastMessageSentAt }));
        });
    }

    @OnEvent(CONVERSATION_EVENTS.CREATED)
    onConversationCreated({ initiatorId, recipientId, conversationId }: ConversationCreateParams) {
        this.gatewayService.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.CREATED, conversationId);
    }

    @OnEvent(CONVERSATION_EVENTS.DELETED)
    onConversationDeleted({ initiatorId, recipientId, conversationId }: ConversationDeleteParams) {
        this.gatewayService.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.DELETED);

        [this.gatewayService.sockets.get(initiatorId), this.gatewayService.sockets.get(recipientId)].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.DELETE, conversationId)); 
        });
    }

    @OnEvent(CONVERSATION_EVENTS.USER_BLOCK)
    onBlock({ initiatorId, recipientId }: { initiatorId: string; recipientId: string }) {
        this.gatewayService.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.USER_BLOCK, recipientId);
    }

    @OnEvent(CONVERSATION_EVENTS.USER_UNBLOCK)
    onUnblock({ initiatorId, recipientId }: { initiatorId: string; recipientId: string }) {
        this.gatewayService.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.USER_UNBLOCK, recipientId);
    }

    @SubscribeMessage(CONVERSATION_EVENTS.START_TYPING)
    async onStartTyping(
        @MessageBody() { conversationId, recipientId }: { conversationId: string; recipientId: string }, 
        @ConnectedSocket() client: SocketWithUser
    ) {
        if (!await this.conversationService.exists({ _id: conversationId, participants: { $all: [client.data.user._id, recipientId] }})) return;

        const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.START_TYPING);

        this.gatewayService.sockets.get(recipientId)?.forEach((socket) => {
            !socket.rooms.has(roomId) && socket.emit(FEED_EVENTS.START_TYPING, {
                _id: conversationId,
                participant: {
                    _id: client.data.user._id.toString(),
                    name: client.data.user.name,
                },
            });
        });
    }

    @SubscribeMessage(CONVERSATION_EVENTS.STOP_TYPING)
    onStopTyping(
        @MessageBody() { recipientId, conversationId }: { conversationId: string; recipientId: string }, 
        @ConnectedSocket() client: SocketWithUser
    ) {
        const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.STOP_TYPING);

        const recipientSockets = this.gatewayService.sockets.get(recipientId);

        recipientSockets?.forEach((socket) => socket.emit(FEED_EVENTS.STOP_TYPING, {
            _id: conversationId,
            participant: { _id: client.data.user._id.toString() },
        }));
    }
}