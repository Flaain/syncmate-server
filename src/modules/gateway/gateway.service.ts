import { HttpStatus } from '@nestjs/common';
import {
    ConnectedSocket,
    GatewayMetadata,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AppException } from 'src/utils/exceptions/app.exception';
import { getRoomIdByParticipants } from 'src/utils/helpers/getRoomIdByParticipants';
import { CookiesService } from 'src/utils/services/cookies/cookies.service';
import { AuthService } from '../auth/auth.service';
import { ConversationService } from '../conversation/conversation.service';
import { CONVERSATION_EVENTS } from '../conversation/types';
import { FEED_EVENTS } from '../feed/types';
import { PRESENCE, USER_EVENTS } from '../user/types';
import { ChangeUserStatusParams, SocketWithUser } from './types';

export const GATEWAY_OPTIONS: GatewayMetadata = {
    cors: {
        origin: Array.isArray(process.env.CLIENT_URL) ? process.env.CLIENT_URL.split(' ') : process.env.CLIENT_URL,
        credentials: true,
    },
};

@WebSocketGateway(GATEWAY_OPTIONS)
export class GatewayService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    readonly server: Server;
    readonly _sockets: Map<string, Array<SocketWithUser>> = new Map();

    constructor(
        private readonly authService: AuthService,
        private readonly conversationService: ConversationService,
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
                
                socket.data.user = await this.authService.validate(userId);

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
}