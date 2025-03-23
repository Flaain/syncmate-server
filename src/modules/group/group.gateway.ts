import { Server } from 'socket.io';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ConversationSendMessageParams, GROUP_EVENTS } from '../conversation/types';
import { SocketWithUser } from '../gateway/types';
import { HttpStatus } from '@nestjs/common';
import { AppException } from 'src/utils/exceptions/app.exception';
import { ParticipantService } from '../participant/participant.service';
import { GroupService } from './group.service';
import { OnEvent } from '@nestjs/event-emitter';
import { GATEWAY_OPTIONS, GatewayService } from '../gateway/gateway.service';

@WebSocketGateway(GATEWAY_OPTIONS)
export class GroupGateway {
    @WebSocketServer()
    readonly server: Server;

    constructor(
        private readonly groupService: GroupService,
        private readonly participantService: ParticipantService,
        private readonly gatewayService: GatewayService,
    ) {}

    @SubscribeMessage(GROUP_EVENTS.JOIN)
    async onJoinGroup(@MessageBody() { groupId }: { groupId: string }, @ConnectedSocket() client: SocketWithUser) {
        const group = await this.groupService.findById(groupId, { projection: { _id: 1 } });

        if (!group) throw new AppException({ message: 'Group not found' }, HttpStatus.NOT_FOUND);

        if (group.isPrivate && !(await this.participantService.exists({ group: group._id, user: client.data.user._id }))) {
            throw new AppException({ message: 'Cannot listen a private group events' }, HttpStatus.FORBIDDEN);
        }

        client.join(groupId);
    }

    @SubscribeMessage(GROUP_EVENTS.LEAVE)
    onLeaveGroup(@MessageBody() { groupId }: { groupId: string }, @ConnectedSocket() client: SocketWithUser) {
        client.leave(groupId);
    }

    @OnEvent(GROUP_EVENTS.MESSAGE_SEND)
    onSendGroupMessage({ feedItem, initiator, session_id }: Omit<ConversationSendMessageParams, 'unreadMessages'>) {
        (this.gatewayService.sockets.get(initiator._id.toString()).find((socket) => socket.handshake.query.session_id === session_id) ?? this.server).to(feedItem.item._id.toString()).emit(GROUP_EVENTS.MESSAGE_SEND, feedItem.item.lastMessage);
    }
}