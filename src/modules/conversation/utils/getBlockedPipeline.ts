import { Types } from 'mongoose';

export const getBlockedPipeline = (initiatorId: Types.ObjectId, recipientId: Types.ObjectId) => [
    {
        $facet: {
            isInitiatorBlocked: [
                { $match: { user: recipientId, $expr: { $in: [initiatorId, { $ifNull: ['$blocklist', []] }] } } },
                { $project: { isBlocked: { $literal: true } } },
            ],
            isRecipientBlocked: [
                { $match: { user: initiatorId, $expr: { $in: [recipientId, { $ifNull: ['$blocklist', []] }] } } },
                { $project: { isBlocked: { $literal: true } } },
            ],
        },
    },
    {
        $project: {
            isInitiatorBlocked: { $first: '$isInitiatorBlocked.isBlocked' },
            isRecipientBlocked: { $first: '$isRecipientBlocked.isBlocked' },
        },
    },
];