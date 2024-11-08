import { Injectable } from "@nestjs/common";
import { Socket } from "socket.io";
import { GatewayService } from "../gateway/gateway.service";
import { FEED_EVENTS, SocketWithUser } from "../gateway/types";
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
            const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);
            const recipient = await this.userService.findOne({ filter: { _id: recipientId } });

            if (!recipient) throw new Error('recipient not found');

            client.join(roomId);
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

        this.gatewayService.sockets.get(initiatorId).concat(this.gatewayService.sockets.get(recipientId)).forEach((socket) => {
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
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_EDIT)
    onEditMessage({ message, recipientId, conversationId, initiatorId, isLastMessage }: ConversationEditMessageParams) {
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        const initiatorSockets = this.gatewayService.sockets.get(initiatorId);
        const recipientSockets = this.gatewayService.sockets.get(recipientId);

        this.gatewayService.server.to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_EDIT, message);

        isLastMessage && [initiatorSockets, recipientSockets].forEach((sockets) => sockets?.forEach((socket) => socket.emit(FEED_EVENTS.EDIT_MESSAGE, {
            message,
            id: conversationId,
        })));
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_DELETE)
    handleDeleteMessage({
        initiatorId,
        recipientId,
        conversationId,
        messageIds,
        lastMessage,
        lastMessageSentAt,
        isLastMessage
    }: ConversationDeleteMessageParams) {
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        const initiatorSockets = this.gatewayService.sockets.get(initiatorId);
        const recipientSockets = this.gatewayService.sockets.get(recipientId);

        this.gatewayService.server.to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_DELETE, messageIds);

        isLastMessage && [initiatorSockets, recipientSockets].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.DELETE_MESSAGE, { id: conversationId, lastMessage, lastMessageSentAt }));
        });
    }

    @OnEvent(CONVERSATION_EVENTS.CREATED)
    onConversationCreated({ initiatorId, recipientId, conversationId }: ConversationCreateParams) {
        this.gatewayService.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.CREATED, conversationId);
    }

    @OnEvent(CONVERSATION_EVENTS.DELETED)
    onConversationDeleted({ initiatorId, recipientId, conversationId }: ConversationDeleteParams) {
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        this.gatewayService.server.to(roomId).emit(CONVERSATION_EVENTS.DELETED);

        const initiatorSockets = this.gatewayService.sockets.get(initiatorId);
        const recipientSockets = this.gatewayService.sockets.get(recipientId);

        [initiatorSockets, recipientSockets].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.DELETE, conversationId));
        });
    }

    @OnEvent(CONVERSATION_EVENTS.USER_BLOCK)
    onBlock({ initiatorId, recipientId }: Pick<ConversationSendMessageParams, 'initiatorId' | 'recipientId'>) {
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        this.gatewayService.server.to(roomId).emit(CONVERSATION_EVENTS.USER_BLOCK, recipientId);
    }

    @OnEvent(CONVERSATION_EVENTS.USER_UNBLOCK)
    onUnblock({ initiatorId, recipientId }: Pick<ConversationSendMessageParams, 'initiatorId' | 'recipientId'>) {
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        this.gatewayService.server.to(roomId).emit(CONVERSATION_EVENTS.USER_UNBLOCK, recipientId);
    }

    @SubscribeMessage(CONVERSATION_EVENTS.START_TYPING)
    async onStartTyping(
        @MessageBody() { conversationId, recipientId }: { conversationId: string; recipientId: string }, 
        @ConnectedSocket() client: SocketWithUser
    ) {
        const conversation = await this.conversationService.exists({ 
            _id: conversationId, 
            participants: { $all: [client.data.user._id, recipientId] } 
        });

        if (!conversation) return;

        const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.START_TYPING);

        const recipientSockets = this.gatewayService.sockets.get(recipientId);

        recipientSockets?.forEach((socket) => {
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