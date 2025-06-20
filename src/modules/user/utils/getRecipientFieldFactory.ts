import { Types } from 'mongoose';
import { UserPrivacySettings } from '../schemas/user.privacy.schema';

export const getRecipientFieldFactory = (
    field: string,
    exceptionId: Types.ObjectId,
    setting: keyof UserPrivacySettings,
) => ({
    [field]: {
        $cond: {
            if: {
                $or: [
                    {
                        $and: [
                            { $eq: [`$settings.privacy_settings.${setting}.mode`, 1] },
                            { $not: [{ $in: [exceptionId, `$settings.privacy_settings.${setting}.deny`] }] },
                        ],
                    },
                    {
                        $and: [
                            { $eq: [`$settings.privacy_settings.${setting}.mode`, 0] },
                            { $in: [exceptionId, `$settings.privacy_settings.${setting}.allow`] },
                        ],
                    },
                ],
            },
            then: `$${field}`,
            else: '$$REMOVE',
        },
    },
});