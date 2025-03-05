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
                        from: 'participants',
                        localField: 'participants',
                        foreignField: '_id',
                        as: 'me',
                        pipeline: [
                            { $match: { user: initiatorId } },
                            { $project: { name: 1, avatar: 1, role: 1, createdAt: 1 } },
                        ],
                    },
                },
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'lastMessage',
                        foreignField: '_id',
                        as: 'lastMessage',
                        let: { groupId: '$_id' },
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
                                                let: { userId: '$_id' },
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
                                                    { $project: { group: 0, user: 0, role: 0 } },
                                                ],
                                                as: 'participant',
                                            },
                                        },
                                        { $unwind: { path: '$participant', preserveNullAndEmptyArrays: true } },
                                        { $project: { _id: 1, name: 1, participant: 1 } },
                                    ],
                                },
                            },
                            { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                            { $project: { source: 0 } }
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
                { $unwind: { path: '$me', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                { $project: { participants: 0, invites: 0, lastMessageSentAt: 0, messages: 0, owner: 0 } },
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