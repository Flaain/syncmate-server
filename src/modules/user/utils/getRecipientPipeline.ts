import { PipelineStage, Types } from 'mongoose';
import { recipientProjection } from 'src/utils/constants';
import { getRecipientFieldFactory } from './getRecipientFieldFactory';

export const getRecipientPipeline = (
    recipientId: string | Types.ObjectId,
    initiatorId: Types.ObjectId,
): Array<PipelineStage> => [
    {
        $match: {
            _id: typeof recipientId === 'string' ? new Types.ObjectId(recipientId) : recipientId,
        },
    },
    {
        $lookup: {
            from: 'files',
            localField: 'avatar',
            foreignField: '_id',
            as: 'avatar',
            pipeline: [{ $project: { url: 1 } }],
        },
    },
    {
        $lookup: {
            from: 'user_settings',
            localField: 'settings',
            foreignField: '_id',
            as: 'settings',
            pipeline: [
                {
                    $lookup: {
                        from: 'privacy_settings',
                        localField: 'privacy_settings',
                        foreignField: '_id',
                        as: 'privacy_settings',
                    },
                },
                { $unwind: { path: '$privacy_settings', preserveNullAndEmptyArrays: true } },
            ],
        },
    },
    { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$settings', preserveNullAndEmptyArrays: true } },
    {
        $project: {
            ...recipientProjection,
            ...getRecipientFieldFactory('email', initiatorId, 'whoCanSeeMyEmail'),
            ...getRecipientFieldFactory('bio', initiatorId, 'whoCanSeeMyBio'),
            ...getRecipientFieldFactory('lastSeenAt', initiatorId, 'whoCanSeeMyLastSeenTime'),
            ...getRecipientFieldFactory('presence', initiatorId, 'whoCanSeeMyLastSeenTime'),
            ...getRecipientFieldFactory('avatar', initiatorId, 'whoCanSeeMyProfilePhotos'),
            isMessagingRestricted: {
                $cond: {
                    if: {
                        $or: [
                            {
                                $and: [
                                    { $eq: [`$settings.privacy_settings.whoCanSendMeMessages.mode`, 1] },
                                    { $in: [initiatorId, `$settings.privacy_settings.whoCanSendMeMessages.deny`] },
                                ],
                            },
                            {
                                $and: [
                                    { $eq: [`$settings.privacy_settings.whoCanSendMeMessages.mode`, 0] },
                                    { $not: [{ $in: [initiatorId, `$settings.privacy_settings.whoCanSendMeMessages.allow`] }] },
                                ],
                            },
                        ],
                    },
                    then: true,
                    else: '$$REMOVE',
                },
            }
        },
    },
];