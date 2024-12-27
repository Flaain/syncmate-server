import { PipelineStage, Types } from 'mongoose';
import { MESSAGES_BATCH } from 'src/modules/conversation/constants';

export const PARTICIPANT_BATCH = 10;

export const messageSenderPipeline = {
    $lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'sender',
        pipeline: [
            {
                $lookup: {
                    from: 'participants',
                    let: { userId: '$user' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [{ $eq: ['$$userId', '$user'] }, { $eq: ['$$groupId', '$group'] }],
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: 'files',
                                localField: 'avatar',
                                foreignField: '_id',
                                as: 'avatar',
                                pipeline: [{ $project: { _id: 1, url: 1 } }],
                            },
                        },
                        { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                    ],
                    as: 'participant',
                },
            },
            { $unwind: { path: '$participant', preserveNullAndEmptyArrays: true } },
            { $project: { name: 1, login: 1, isOfficial: 1, participant: 1 } },
        ],
    },
};

export const getGroupPipeline = (groupId: string, initiatorId: Types.ObjectId): Array<PipelineStage> => [
    { $match: { _id: new Types.ObjectId(groupId) } },
    {
        $lookup: {
            from: 'participants',
            localField: 'participants',
            foreignField: '_id',
            as: 'me',
            pipeline: [
                { $match: { user: initiatorId, group: new Types.ObjectId(groupId) } },
                { $project: { name: 1, avatar: 1, role: 1, createdAt: 1 } },
            ],
        },
    },
    {
        $lookup: {
            from: 'messages',
            localField: 'messages',
            foreignField: '_id',
            as: 'm',
            let: { groupId: '$_id' },
            pipeline: [
                { $sort: { createdAt: -1 } },
                { $limit: MESSAGES_BATCH },
                messageSenderPipeline,
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'replyTo',
                        foreignField: '_id',
                        as: 'replyTo',
                        pipeline: [
                            messageSenderPipeline,
                            { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                            { $project: { text: 1, sender: 1 } },
                        ],
                    },
                },
                { $unwind: { path: '$replyTo', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                { $project: { source: 0 } },
            ],
        },
    },
    { $project: { messages: 0, owner: 0, invites: 0, lastMessageSentAt: 0, lastMessage: 0 } },
    { $unwind: { path: '$me', preserveNullAndEmptyArrays: true } },
    {
        $addFields: {
            participants: { $size: '$participants' },
            messages: {
                data: '$m',
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
    { $unset: ['m'] },
];

export const getParticipantsPipeline = (
    groupId: string,
    initiatorId: Types.ObjectId,
    cursor: string,
): Array<PipelineStage> => [
    { $match: { _id: new Types.ObjectId(groupId) } },
    {
        $lookup: {
            from: 'participants',
            localField: 'participants',
            foreignField: '_id',
            as: 'me',
            pipeline: [{ $match: { user: initiatorId, group: new Types.ObjectId(groupId) } }, { $project: { _id: 1 } }],
        },
    },
    {
        $lookup: {
            from: 'participants',
            localField: 'participants',
            foreignField: '_id',
            as: 'p',
            pipeline: [
                {
                    $match: { $expr: { $ne: ['$user', initiatorId] } },
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'user',
                        pipeline: [{ $project: { login: 1, name: 1, lastSeenAt: 1 } }],
                    },
                },
                { $match: cursor ? { 'user.lastSeenAt': { $lt: new Date(cursor) } } : {} },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                { $project: { name: 1, avatar: 1, user: 1, role: 1, createdAt: 1 } },
                { $sort: { 'user.lastSeenAt': -1 } },
                { $limit: PARTICIPANT_BATCH },
            ],
        },
    },
    { $unwind: { path: '$me', preserveNullAndEmptyArrays: true } },
    { $project: { participants: 0 } },
    {
        $addFields: {
            participants: {
                data: '$p',
                nextCursor: {
                    $cond: {
                        if: { $eq: [{ $size: '$p' }, PARTICIPANT_BATCH] },
                        then: { $arrayElemAt: ['$p.user.lastSeenAt', -1] },
                        else: null,
                    },
                },
            },
        },
    },
    { $unset: 'p' },
    { $project: { me: 1, participants: 1 } }
];