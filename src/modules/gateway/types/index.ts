import { Socket } from 'socket.io';
import { PRESENCE, UserDocument } from 'src/modules/user/types';
import { DefaultEventsMap  } from 'socket.io/dist/typed-events';

export interface ChangeUserStatusParams {
    presence: PRESENCE;
    lastSeenAt?: Date;
}

export interface SocketWithUser extends Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: UserDocument }> {}
