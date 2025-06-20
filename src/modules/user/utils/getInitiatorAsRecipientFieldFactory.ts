import { Types } from 'mongoose';
import { UserPrivacySettings } from '../schemas/user.privacy.schema';

export const getInitiatorAsRecipientFieldFactory = (
    field: string,
    recipientId: Types.ObjectId,
    setting: keyof UserPrivacySettings,
) => ({
    [field]: {
        $cond: {
            if: {
                $or: [
                    {
                        $and: [
                            { $eq: [`$privacy_settings.${setting}.mode`, 1] },
                            { $not: [{ $in: [recipientId, `$privacy_settings.${setting}.deny`] }] },
                        ],
                    },
                    {
                        $and: [
                            { $eq: [`$privacy_settings.${setting}.mode`, 0] },
                            { $in: [recipientId, `$privacy_settings.${setting}.allow`] },
                        ],
                    },
                ],
            },
            then: true,
            else: false,
        },
    },
});