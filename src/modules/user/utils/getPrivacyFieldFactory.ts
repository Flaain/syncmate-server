import { UserPrivacySettings } from '../schemas/user.privacy.schema';

export const getPrivacyFieldFactory = (field: keyof UserPrivacySettings) => ({
    [field]: {
        mode: `$privacy_settings.${field}.mode`,
        deny: {
            $cond: {
                if: {
                    $and: [
                        { $eq: [`$privacy_settings.${field}.mode`, 1] },
                        { $ne: [{ $size: `$privacy_settings.${field}.deny` }, 0] },
                    ],
                },
                then: { $size: `$privacy_settings.${field}.deny` },
                else: '$$REMOVE',
            },
        },
        allow: {
            $cond: {
                if: {
                    $and: [
                        { $eq: [`$privacy_settings.${field}.mode`, 0] },
                        { $ne: [{ $size: `$privacy_settings.${field}.allow` }, 0] },
                    ],
                },
                then: { $size: `$privacy_settings.${field}.allow` },
                else: '$$REMOVE',
            },
        },
    },
});