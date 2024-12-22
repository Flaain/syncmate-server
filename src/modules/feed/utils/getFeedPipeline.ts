import { PipelineStage } from 'mongoose';
import { GetFeedPipelineParams } from '../types';
import { recipientProjection } from 'src/modules/conversation/constants';

export const getFeedPipeline = ({ initiatorId, cursor, limit = 10 }: GetFeedPipelineParams): Array<PipelineStage> => [
    { $match: { users: initiatorId, ...(cursor && { lastActionAt: { $lt: new Date(cursor) } }) } },
    { $sort: { lastActionAt: -1 } },
    { $limit: limit },
    {
        $lookup: {
            from: 'conversations',
            localField: 'item',
            foreignField: '_id',
            as: 'conversation',
            pipeline: [
                {
                    $lookup: {
                        from: 'users',
                        localField: 'participants',
                        foreignField: '_id',
                        pipeline: [
                            { $match: { $expr: { $ne: ['$_id', initiatorId] } } },
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
                            { $project: recipientProjection },
                        ],
                        as: 'participants',
                    },
                },
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'messages',
                        foreignField: '_id',
                        as: 'unreadMessages',
                        pipeline: [
                            { $match: { hasBeenRead: false, sender: { $ne: initiatorId } } },
                            { $count: 'unreadMessages' },
                        ],
                    },
                },
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'lastMessage',
                        foreignField: '_id',
                        as: 'lastMessage',
                        pipeline: [
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'sender',
                                    foreignField: '_id',
                                    as: 'sender',
                                    pipeline: [{ $project: { _id: 1, name: 1 } }],
                                },
                            },
                            { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                            { $project: { _id: 1, text: 1, createdAt: 1, sender: 1 } },
                        ],
                    },
                },
                { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 1,
                        lastMessage: 1,
                        unreadMessages: { $first: '$unreadMessages.unreadMessages' },
                        recipient: { $first: '$participants' },
                    },
                },
            ],
        },
    },
    {
        $lookup: {
            from: 'groups',
            localField: 'item',
            foreignField: '_id',
            as: 'group',
            pipeline: [
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'lastMessage',
                        foreignField: '_id',
                        as: 'lastMessage',
                        pipeline: [
                            {
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
                                                                $and: [
                                                                    { $eq: ['$$userId', '$user'] },
                                                                    { $eq: ['$$ROOT.item', '$group'] },
                                                                ],
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
                                    ],
                                },
                            },
                            { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                        ],
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
                {
                    $lookup: {
                        from: 'participants',
                        localField: 'owner',
                        foreignField: '_id',
                        as: 'owner',
                        pipeline: [
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'user',
                                    foreignField: '_id',
                                    as: 'user',
                                    pipeline: [{ $project: { _id: 1, name: 1 } }],
                                },
                            },
                            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                            { $project: { _id: 1, name: 1, user: 1 } }
                        ]
                    }
                },
                { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                { $project: { participants: 0, invites: 0, lastMessageSentAt: 0, messages: 0 } },
            ],
        },
    },
    // { $lookup: { from: 'channels', localField: 'item', foreignField: '_id', as: '#' } },
    // { $lookup: { from: 'clouds', localField: 'item', foreignField: '_id', as: '#' } },
    {
        $set: {
            item: {
                $mergeObjects: [
                    { $first: '$conversation' },
                    { $first: '$group' },
                    { $first: '$_temporaryCloud' },
                ],
            },
        },
    },
    { $unset: ['conversation', 'group', '_temporaryCloud'] },
    { $project: { _id: 1, type: 1, lastActionAt: 1, item: 1 } },
];