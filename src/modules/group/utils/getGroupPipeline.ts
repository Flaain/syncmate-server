import { PipelineStage, Types } from 'mongoose';
import { MESSAGES_BATCH } from 'src/modules/conversation/constants';
import { PARTICIPANT_BATCH, messageSenderPipeline } from '../constants';

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
            from: 'participants',
            localField: 'participants',
            foreignField: '_id',
            as: 'p',
            pipeline: [
                { $match: { $expr: { $ne: ['$user', initiatorId] } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'user',
                        pipeline: [{ $project: { login: 1, name: 1, lastSeenAt: 1 } }],
                    },
                },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                { $project: { name: 1, avatar: 1, user: 1, role: 1, createdAt: 1 } },
                { $sort: { 'user.lastSeenAt': -1 } },
                { $limit: PARTICIPANT_BATCH },
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
    { $project: { participants: 0, messages: 0, owner: 0, invites: 0, lastMessageSentAt: 0, lastMessage: 0 } },
    { $unwind: { path: '$me', preserveNullAndEmptyArrays: true } },
    {
        $addFields: {
            participants: {
                data: '$p',
                nextCursor: {
                    $cond: {
                        if: { $eq: [{ $size: '$p' }, PARTICIPANT_BATCH] },
                        then: { $arrayElemAt: ['$p._id', -1] },
                        else: null,
                    },
                },
            },
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
    { $unset: ['p', 'm'] },
];