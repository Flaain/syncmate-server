import { createZodDto } from 'nestjs-zod';
import { userPrivacySettingModeSchema } from '../schemas/user.settings.privacy.mode.schema';

export class UserPrivacySettingsModeDTO extends createZodDto(userPrivacySettingModeSchema) {}