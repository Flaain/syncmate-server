import { PRESENCE, UserDocument } from 'src/modules/user/types';
import { Socket,  } from 'socket.io';
import { DefaultEventsMap  } from 'socket.io/dist/typed-events';

export enum USER_EVENTS {
    PRESENCE = 'user.presence',
    BLOCK = 'user.block',
    UNBLOCK = 'user.unblock',
}

export enum FEED_EVENTS {
    EDIT_MESSAGE = 'feed.edit.message',
    DELETE_MESSAGE = 'feed.delete.message',
    CREATE = 'feed.create',
    DELETE = 'feed.delete',
    START_TYPING = 'feed.start.typing',
    STOP_TYPING = 'feed.stop.typing',
    USER_PRESENCE = 'feed.user.presence',
}

export interface ChangeUserStatusParams {
    presence: PRESENCE;
    lastSeenAt?: Date;
}

export interface SocketWithUser extends Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: UserDocument }> {}
