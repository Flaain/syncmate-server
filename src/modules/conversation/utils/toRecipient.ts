import { Types } from 'mongoose';
import { User } from 'src/modules/user/schemas/user.schema';

export const toRecipient = (user: User & { _id: Types.ObjectId }) => ({
    _id: user._id.toString(),
    avatar: user.avatar,
    name: user.name,
    login: user.login,
    presence: user.presence,
    isOfficial: user.isOfficial,
});