import * as dotenv from 'dotenv';
import { GatewayMetadata, OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PRESENCE, USER_EVENTS } from '../user/types';
import { SocketWithUser } from './types';
import { EventEmitter2 } from '@nestjs/event-emitter';

dotenv.config(); // TODO: find better way to resolve env

export const GATEWAY_OPTIONS: GatewayMetadata = {
    cors: {
        origin: process.env.CLIENT_URL.split(' '),
        credentials: true,
    },
};

@WebSocketGateway(GATEWAY_OPTIONS)
export class GatewayService implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    private readonly server: Server;
    
    readonly _sockets: Map<string, Array<SocketWithUser>> = new Map();

    constructor(private readonly eventEmitter: EventEmitter2) {}

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

    handleConnection(client: SocketWithUser) {
        this.socket = { userId: client.data.user._id.toString(), socket: client };
    }

    handleDisconnect(client: SocketWithUser) {
        this.removeSocket({ userId: client.data.user._id.toString(), socket: client });

        !this.sockets.has(client.data.user._id.toString()) && this.eventEmitter.emit(USER_EVENTS.PRESENCE, { 
            presence: PRESENCE.OFFLINE, 
            lastSeenAt: new Date() 
        }, client);
    }
}