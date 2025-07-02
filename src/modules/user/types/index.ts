import { z } from 'zod';
import { User } from '../schemas/user.schema';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { IPagination } from 'src/utils/types';
import { userEditSchema } from '../schemas/user.edit.schema';
import { userPrivacySettingModeSchema } from '../schemas/user.settings.privacy.mode.schema';

export enum PRESENCE {
    ONLINE = 'online',
    OFFLINE = 'offline'
}

export enum USER_EVENTS {
    PRESENCE = 'user.presence'
}

export const PRIVACY_MODE = {
    0: 'nobody',
    1: 'everybody',
} as const;

export type CheckType = 'email' | 'login';

export type PrivacyMode = keyof typeof PRIVACY_MODE;

export type UserEditDTO = z.infer<typeof userEditSchema>;
export type UserPrivacySettingModeDTO = z.infer<typeof userPrivacySettingModeSchema>;

export type UserDocument = HydratedDocument<User>;
export type UserSearchParams = IPagination & { initiatorId: Types.ObjectId };

export interface PrivacySetting {
    mode: PrivacyMode,
    deny?: Array<mongoose.Types.ObjectId>;
    allow?: Array<mongoose.Types.ObjectId>;
}