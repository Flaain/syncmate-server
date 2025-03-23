import { PipelineStage, Types } from 'mongoose';
import { MESSAGES_BATCH } from '../constants';

export const getConversationPipeline = (
    initiatorId: Types.ObjectId,
    recipientId: Types.ObjectId,
    cursor?: string,
): Array<PipelineStage> => [
    { $match: { participants: { $all: [initiatorId, recipientId] } } },
    {
        $lookup: {
            from: 'messages',
            localField: 'messages',
            foreignField: '_id',
            as: 'm',
            pipeline: [
                { $match: cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {} },
                { $sort: { createdAt: -1 } },
                { $limit: MESSAGES_BATCH },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'sender',
                        foreignField: '_id',
                        as: 'sender',
                        pipeline: [
                            { $project: { name: 1, isDeleted: 1, avatar: 1 } },
                            {
                                $lookup: {
                                    from: 'files',
                                    localField: 'avatar',
                                    foreignField: '_id',
                                    as: 'avatar',
                                    pipeline: [{ $project: { url: 1 } }],
                                },
                            },
                            { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                        ],
                    },
                },
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'replyTo',
                        foreignField: '_id',
                        as: 'replyTo',
                        pipeline: [
                            { $project: { text: 1, sender: 1 } },
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'sender',
                                    foreignField: '_id',
                                    as: 'sender',
                                    pipeline: [{ $project: { name: 1 } }],
                                },
                            },
                            { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                        ],
                    },
                },
                { $unwind: { path: '$attachments', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$replyTo', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        hasBeenRead: {
                            $cond: {
                                if: { $and: [{ $eq: ['$sender._id', initiatorId] }, { $in: [recipientId, '$read_by'] }] },
                                then: true,
                                else: '$$REMOVE',
                            },
                        },
                        alreadyRead: {
                            $cond: {
                                if: { $and: [{ $eq: ['$sender._id', recipientId] }, { $in: [initiatorId, '$read_by'] }] },
                                then: true,
                                else: '$$REMOVE',
                            },
                        },
                    },
                },
                { $project: { source: 0, read_by: 0, replies: 0 } },
            ],
        },
    },
    { $project: { messages: 0 } },
    {
        $addFields: {
            messages: {
                data: { $reverseArray: '$m' },
                nextCursor: {
                    $cond: {
                        if: { $eq: [{ $size: '$m' }, MESSAGES_BATCH] },
                        then: { $arrayElemAt: ['$m._id', -1] },
                        else: null,
                    },
                },
            },
        },
    },
    { $unset: 'm' },
    { $project: { messages: 1 } },
];

export const isBlockedPipeline = (initiatorId: Types.ObjectId, recipientId: Types.ObjectId) => [
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