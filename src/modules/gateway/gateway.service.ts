import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GatewayManager } from './gateway.manager';
import { GatewayUtils } from './gateway.utils';
import { OnEvent } from '@nestjs/event-emitter';
import {
    ConversationCreateParams,
    ConversationDeleteMessageParams,
    ConversationDeleteParams,
    ConversationSendMessageParams,
    ConversationEditMessageParams,
    ChangeUserStatusParams,
    SocketWithUser,
    USER_EVENTS,
    FEED_EVENTS,
    CONVERSATION_EVENTS,
} from './types';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { UserService } from '../user/user.service';
import { AppException } from 'src/utils/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { CookiesService } from 'src/utils/services/cookies/cookies.service';
import { JWT_KEYS } from 'src/utils/types';
import { ConversationService } from '../conversation/conversation.service';
import { PRESENCE } from '../user/types';

@WebSocketGateway({ cors: { origin: ['http://localhost:4173', 'http://localhost:5173'], credentials: true } })
export class GatewayService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    private server: Server;

    constructor(
        private readonly userService: UserService,
        private readonly conversationService: ConversationService,
        private readonly configService: ConfigService,
        private readonly cookiesService: CookiesService,
        private readonly jwtService: JwtService,
        private readonly gatewayManager: GatewayManager,
    ) {}

    afterInit(server: Server) {
        server.use(async (socket, next) => {
            const cookies = socket.handshake.headers.cookie;

            if (!cookies) return next(new AppException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED));

            try {
                const { accessToken } = this.cookiesService.parseCookies(cookies);

                if (!accessToken) return next(new AppException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED));

                const user = await this.userService.findOne({
                    filter: {
                        _id: this.jwtService.verify<{ userId: string }>(accessToken, {
                            secret: this.configService.get(JWT_KEYS.ACCESS_TOKEN_SECRET),
                        }).userId,
                        isDeleted: false,
                    },
                });

                if (!user) return next(new AppException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED));

                socket.data.user = user;

                return next();
            } catch (error) {
                console.log(error);
                return next(error);
            }
        });
    }

    @SubscribeMessage(USER_EVENTS.PRESENCE)
    async changeUserStatus(
        @MessageBody() { presence, lastSeenAt }: ChangeUserStatusParams,
        @ConnectedSocket() client: SocketWithUser,
    ) {
        if (client.data.user.presence === presence) return;

        client.data.user.presence = presence;

        const initiatorId = client.data.user._id;

        const { 0: conversations } = await Promise.all([
            this.conversationService.find({
                filter: { participants: { $in: initiatorId } },
                projection: { participants: 1 },
                options: {
                    populate: [
                        {
                            path: 'participants',
                            model: 'User',
                            select: '_id',
                            match: { _id: { $ne: initiatorId } },
                        },
                    ],
                },
            }),
            client.data.user.updateOne({ presence, lastSeenAt }),
        ]);

        conversations.forEach((conversation) => {
            const recipientId = conversation.participants[0]._id.toString();
            const recipientSockets = this.gatewayManager.sockets.get(recipientId);
            // const isBlocked = client.data.user.blockList.some((id) => id.toString() === recipientId);

            recipientSockets?.forEach((socket) =>
                socket.emit(FEED_EVENTS.USER_PRESENCE, { recipientId: initiatorId.toString(), presence }),
            );

            client
                .to(GatewayUtils.getRoomIdByParticipants([initiatorId.toString(), recipientId]))
                .emit(CONVERSATION_EVENTS.PRESENCE, {
                    presence,
                    lastSeenAt,
                });
        });
    }

    handleConnection(client: SocketWithUser) {
        this.gatewayManager.socket = { userId: client.data.user._id.toString(), socket: client };
    }

    handleDisconnect(client: SocketWithUser) {
        this.gatewayManager.removeSocket({ userId: client.data.user._id.toString(), socket: client });

        !this.gatewayManager.sockets.has(client.data.user._id.toString()) &&
            this.changeUserStatus({ presence: PRESENCE.OFFLINE, lastSeenAt: new Date() }, client);
    }

    @SubscribeMessage(CONVERSATION_EVENTS.JOIN)
    async handleJoinConversation(
        @MessageBody() { recipientId }: { recipientId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const roomId = GatewayUtils.getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        try {
            const recipient = await this.userService.findOne({ filter: { _id: recipientId } });

            if (!recipient) throw new Error('recipient not found');

            client.join(roomId);
        } catch (error) {
            client.emit(`${roomId}:error`, { error: error.message });
        }
    }

    @SubscribeMessage(CONVERSATION_EVENTS.LEAVE)
    async handleLeaveConversation(
        @MessageBody() { recipientId }: { recipientId: string },
        @ConnectedSocket() client: Socket,
    ) {
        client.leave(GatewayUtils.getRoomIdByParticipants([client.data.user._id.toString(), recipientId]));
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_SEND)
    async onNewMessage({ message, recipientId, conversationId, initiatorId }: ConversationSendMessageParams) {
        const roomId = GatewayUtils.getRoomIdByParticipants([initiatorId, recipientId]);

        const initiatorSockets = this.gatewayManager.sockets.get(initiatorId);
        const recipientSockets = this.gatewayManager.sockets.get(recipientId);

        this.server.to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_SEND, message);
        this.server.to(roomId).emit(CONVERSATION_EVENTS.STOP_TYPING);

        [initiatorSockets, recipientSockets].forEach((sockets) =>
            sockets?.forEach((socket) => {
                socket.emit(FEED_EVENTS.CREATE_MESSAGE, {
                    message,
                    id: conversationId,
                });

                socket.data.user._id.toString() === recipientId && socket.emit(FEED_EVENTS.STOP_TYPING, {
                    _id: conversationId,
                    participant: { _id: initiatorId },
                });
            }),
        );
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_EDIT)
    async onEditMessage({
        message,
        recipientId,
        conversationId,
        initiatorId,
        isLastMessage,
    }: ConversationEditMessageParams) {
        const roomId = GatewayUtils.getRoomIdByParticipants([initiatorId, recipientId]);

        const initiatorSockets = this.gatewayManager.sockets.get(initiatorId);
        const recipientSockets = this.gatewayManager.sockets.get(recipientId);

        this.server.to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_EDIT, message);

        isLastMessage && [initiatorSockets, recipientSockets].forEach((sockets) => sockets?.forEach((socket) => socket.emit(FEED_EVENTS.EDIT_MESSAGE, {
            message,
            id: conversationId,
        })));
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_DELETE)
    async handleDeleteMessage({
        initiatorId,
        recipientId,
        conversationId,
        messageIds,
        lastMessage,
        lastMessageSentAt,
        isLastMessage
    }: ConversationDeleteMessageParams) {
        const roomId = GatewayUtils.getRoomIdByParticipants([initiatorId, recipientId]);

        const initiatorSockets = this.gatewayManager.sockets.get(initiatorId);
        const recipientSockets = this.gatewayManager.sockets.get(recipientId);

        this.server.to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_DELETE, messageIds);

        isLastMessage && [initiatorSockets, recipientSockets].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.DELETE_MESSAGE, { id: conversationId, lastMessage, lastMessageSentAt }));
        });
    }

    @OnEvent(CONVERSATION_EVENTS.CREATED)
    async onConversationCreated({ initiator, conversationId, recipient, lastMessageSentAt }: ConversationCreateParams) {
        const newConversation = { _id: conversationId, lastMessageSentAt };

        const roomId = GatewayUtils.getRoomIdByParticipants([initiator._id.toString(), recipient._id.toString()]);

        this.server.to(roomId).emit(CONVERSATION_EVENTS.CREATED, newConversation);

        const initiatorSockets = this.gatewayManager.sockets.get(initiator._id.toString());
        const recipientSockets = this.gatewayManager.sockets.get(recipient._id.toString());

        [initiatorSockets, recipientSockets].forEach((sockets) => {
            sockets?.forEach((socket) => {
                socket.emit(FEED_EVENTS.CREATE_CONVERSATION, {
                    ...newConversation,
                    recipient: socket.data.user._id.toString() === recipient._id.toString() ? initiator.toObject() : recipient,
                });
            });
        });
    }

    @OnEvent(CONVERSATION_EVENTS.DELETED)
    async onConversationDeleted({ initiatorId, recipientId, conversationId }: ConversationDeleteParams) {
        const roomId = GatewayUtils.getRoomIdByParticipants([initiatorId, recipientId]);

        this.server.to(roomId).emit(CONVERSATION_EVENTS.DELETED);

        const initiatorSockets = this.gatewayManager.sockets.get(initiatorId);
        const recipientSockets = this.gatewayManager.sockets.get(recipientId);

        [initiatorSockets, recipientSockets].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.DELETE_CONVERSATION, conversationId));
        });
    }

    @OnEvent(CONVERSATION_EVENTS.USER_BLOCK)
    async onBlock({ initiatorId, recipientId }: Pick<ConversationSendMessageParams, 'initiatorId' | 'recipientId'>) {
        const roomId = GatewayUtils.getRoomIdByParticipants([initiatorId, recipientId]);

        this.server.to(roomId).emit(CONVERSATION_EVENTS.USER_BLOCK, recipientId);
    }

    @OnEvent(CONVERSATION_EVENTS.USER_UNBLOCK)
    async onUnblock({ initiatorId, recipientId }: Pick<ConversationSendMessageParams, 'initiatorId' | 'recipientId'>) {
        const roomId = GatewayUtils.getRoomIdByParticipants([initiatorId, recipientId]);

        this.server.to(roomId).emit(CONVERSATION_EVENTS.USER_UNBLOCK, recipientId);
    }

    @SubscribeMessage(CONVERSATION_EVENTS.START_TYPING)
    async onStartTyping(
        @MessageBody() { conversationId, recipientId }: { conversationId: string; recipientId: string },
        @ConnectedSocket() client: SocketWithUser,
    ) {
        const conversation = await this.conversationService.exists({
            _id: conversationId,
            participants: { $all: [client.data.user._id, recipientId] },
        });

        if (!conversation) return;

        const roomId = GatewayUtils.getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.START_TYPING);

        const recipientSockets = this.gatewayManager.sockets.get(recipientId);

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
    async onStopTyping(
        @MessageBody() { recipientId, conversationId }: { conversationId: string; recipientId: string },
        @ConnectedSocket() client: SocketWithUser,
    ) {
        const roomId = GatewayUtils.getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.STOP_TYPING);

        const recipientSockets = this.gatewayManager.sockets.get(recipientId);

        recipientSockets?.forEach((socket) => socket.emit(FEED_EVENTS.STOP_TYPING, {
            _id: conversationId,
            participant: { _id: client.data.user._id.toString() },
        }));
    }
}