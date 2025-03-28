import { PipelineStage } from 'mongoose';
import { recipientProjection } from 'src/modules/conversation/constants';
import { SearchPipelineParams } from 'src/utils/types';
import { GetFeedPipelineParams } from '../types';

export const getFeedSearchPipeline = ({ initiatorId, query }: Pick<SearchPipelineParams, 'initiatorId' | 'query'>): Array<PipelineStage.FacetPipelineStage> => [
    {
        $match: {
            $or: [{ login: { $regex: query, $options: 'i' } }, { name: { $regex: query, $options: 'i' } }],
            _id: { $ne: initiatorId },
            isDeleted: false,
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
    { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
    {
        $project: {
            _id: 1,
            name: 1,
            login: 1,
            isOfficial: 1,
            createdAt: 1,
            avatar: 1,
            type: { $literal: 'User' },
        },
    },
    { $sort: { createdAt: -1 } },
];

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
                            { $match: { sender: { $ne: initiatorId }, read_by: { $nin: [initiatorId] } } },
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
        $set: {
            item: {
                $mergeObjects: [{ $first: '$conversation' }, { $first: '$_temporaryCloud' }],
            },
        },
    },
    { $unset: ['conversation', '_temporaryCloud'] },
    { $project: { _id: 1, type: 1, lastActionAt: 1, item: 1 } },
];