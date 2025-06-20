import { z } from 'zod';
import { privacySettingPaths } from '../constants';

export const userPrivacySettingModeSchema = z.strictObject({
    setting: z.enum(privacySettingPaths, { message: 'Invalid setting' }),
    mode: z.union([z.literal(0), z.literal(1)]),
});