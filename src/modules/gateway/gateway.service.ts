import { Server, Socket } from 'socket.io';
import { ChangeUserStatusParams, SocketWithUser} from './types';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { AppException } from 'src/utils/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { CookiesService } from 'src/utils/services/cookies/cookies.service';
import { ConversationService } from '../conversation/conversation.service';
import { PRESENCE, USER_EVENTS } from '../user/types';
import { AuthService } from '../auth/auth.service';
import { CONVERSATION_EVENTS, ConversationCreateParams, ConversationDeleteMessageParams, ConversationDeleteParams, ConversationEditMessageParams, ConversationSendMessageParams } from '../conversation/types';
import { FEED_EVENTS } from '../feed/types';
import { getRoomIdByParticipants } from 'src/utils/helpers/getRoomIdByParticipants';
import { OnEvent } from '@nestjs/event-emitter';
import { UserService } from '../user/user.service';
import { toRecipient } from '../conversation/utils/toRecipient';

@WebSocketGateway({ cors: { origin: ['http://localhost:4173', 'http://localhost:5173', 'https://fchat-client.vercel.app'], credentials: true } })
export class GatewayService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    public readonly server: Server;
    private readonly _sockets: Map<string, Array<SocketWithUser>> = new Map();

    constructor(
        private readonly authService: AuthService,
        private readonly conversationService: ConversationService,
        private readonly userService: UserService,
        private readonly cookiesService: CookiesService
    ) {}


    get sockets(): Map<string, Array<SocketWithUser>> {
        return this._sockets;
    }

    set socket({ userId, socket }: { userId: string; socket: SocketWithUser }) {
        const sockets = this.sockets.get(userId);

        this._sockets.set(userId, sockets ? [...sockets, socket] : [socket]);
    }

    private removeSocket = ({ userId, socket }: { userId: string; socket: SocketWithUser }) => {
        const filteredSockets = this.sockets.get(userId).filter((client) => client.id !== socket.id);

        filteredSockets.length ? this._sockets.set(userId, filteredSockets) : this._sockets.delete(userId);
    }

    afterInit(server: Server) {
        server.use(async (socket, next) => {
            try {
                const cookies = socket.handshake.headers.cookie;
    
                if (!cookies) throw new AppException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
                
                const { accessToken } = this.cookiesService.parseCookies(cookies);

                if (!accessToken) throw new AppException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);

                const { userId } = this.authService.verifyToken(accessToken, 'access');
                const user = await this.authService.validate(userId);

                socket.data.user = user;
                
                return next();
            } catch (error) {
                console.log(error);
                return next(error);
            }
        });
    }

    @SubscribeMessage(USER_EVENTS.PRESENCE)
    async changeUserStatus(@MessageBody() { presence, lastSeenAt }: ChangeUserStatusParams, @ConnectedSocket() client: SocketWithUser) {
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
            const recipientSockets = this.sockets.get(recipientId);

            recipientSockets?.forEach((socket) => socket.emit(FEED_EVENTS.USER_PRESENCE, { recipientId: initiatorId.toString(), presence }));
            
            client.to(getRoomIdByParticipants([initiatorId.toString(), recipientId])).emit(CONVERSATION_EVENTS.PRESENCE, { presence, lastSeenAt });
        });
    }

    handleConnection(client: SocketWithUser) {
        this.socket = { userId: client.data.user._id.toString(), socket: client };
    }

    handleDisconnect(client: SocketWithUser) {
        this.removeSocket({ userId: client.data.user._id.toString(), socket: client });

        !this.sockets.has(client.data.user._id.toString()) && this.changeUserStatus({ presence: PRESENCE.OFFLINE, lastSeenAt: new Date() }, client);
    }

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
    onNewMessage({ initiator, initiatorSocketId, feedItem }: ConversationSendMessageParams) {
        const initiatorId = initiator._id.toString();
        const recipientId = feedItem.item.recipient._id.toString();
        const roomId = getRoomIdByParticipants([initiatorId, recipientId]);

        (this.server.sockets.sockets.get(initiatorSocketId) ?? this.server).to(roomId).emit(CONVERSATION_EVENTS.MESSAGE_SEND, feedItem.item.lastMessage);
        this.server.to(roomId).emit(CONVERSATION_EVENTS.STOP_TYPING);

        [this.sockets.get(initiatorId), this.sockets.get(recipientId)].forEach((sockets) => {
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
    onEditMessage({ isLastMessage, conversationId, initiatorId, initiatorSocketId, message, recipientId }: ConversationEditMessageParams) {
        (this.server.sockets.sockets.get(initiatorSocketId) ?? this.server).to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_EDIT, message);
        
        isLastMessage && [this.sockets.get(initiatorId), this.sockets.get(recipientId)].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.UPDATE, { itemId: conversationId, lastMessage: message }));
        })
    }

    @OnEvent(CONVERSATION_EVENTS.MESSAGE_DELETE)
    handleDeleteMessage({ initiatorId, recipientId, conversationId, findedMessageIds, lastMessage, lastMessageSentAt, isLastMessage }: ConversationDeleteMessageParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.MESSAGE_DELETE, findedMessageIds);
        
        isLastMessage && [this.sockets.get(initiatorId), this.sockets.get(recipientId)].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.UPDATE, { itemId: conversationId, lastMessage, lastActionAt: lastMessageSentAt }));
        });
    }

    @OnEvent(CONVERSATION_EVENTS.CREATED)
    onConversationCreated({ initiatorId, recipientId, conversationId }: ConversationCreateParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.CREATED, conversationId);
    }

    @OnEvent(CONVERSATION_EVENTS.DELETED)
    onConversationDeleted({ initiatorId, recipientId, conversationId }: ConversationDeleteParams) {
        this.server.to(getRoomIdByParticipants([initiatorId, recipientId])).emit(CONVERSATION_EVENTS.DELETED);

        [this.sockets.get(initiatorId), this.sockets.get(recipientId)].forEach((sockets) => {
            sockets?.forEach((socket) => socket.emit(FEED_EVENTS.DELETE, conversationId)); 
        });
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
        @ConnectedSocket() client: SocketWithUser
    ) {
        if (!await this.conversationService.exists({ _id: conversationId, participants: { $all: [client.data.user._id, recipientId] }})) return;

        const roomId = getRoomIdByParticipants([client.data.user._id.toString(), recipientId]);

        client.to(roomId).emit(CONVERSATION_EVENTS.START_TYPING, client.data.user._id.toString());

        this.sockets.get(recipientId)?.forEach((socket) => {
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

        const recipientSockets = this.sockets.get(recipientId);

        recipientSockets?.forEach((socket) => socket.emit(FEED_EVENTS.STOP_TYPING, {
            _id: conversationId,
            participant: { _id: client.data.user._id.toString() },
        }));
    }
}