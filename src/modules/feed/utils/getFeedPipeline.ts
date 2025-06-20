import { PipelineStage } from 'mongoose';
import { SearchPipelineParams } from 'src/utils/types';
import { GetFeedPipelineParams } from '../types';
import { getRecipientFieldFactory } from 'src/modules/user/utils/getRecipientFieldFactory';

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

export const getFeedPipeline = ({ initiatorId, ids, cursor, limit = 10 }: GetFeedPipelineParams): Array<PipelineStage> => [
    { $match: { configs: { $in: ids }, ...(cursor && { lastActionAt: { $lt: new Date(cursor) } }) } },
    { $sort: { lastActionAt: -1 } },
    { $limit: limit },
    {
        $lookup: {
            from: 'feed_configs',
            localField: 'configs',
            foreignField: '_id',
            as: 'config',
            pipeline: [{ $match: { userId: initiatorId } }, { $project: { _id: 1 } }],
        },
    },
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
                            { $unwind: { path: '$settings', preserveNullAndEmptyArrays: true } },
                            { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                            {
                                $project: {
                                    name: 1,
                                    login: 1,
                                    isOfficial: 1,
                                    ...getRecipientFieldFactory('lastSeenAt', initiatorId, 'whoCanSeeMyLastSeenTime'),
                                    ...getRecipientFieldFactory('presence', initiatorId, 'whoCanSeeMyLastSeenTime'),
                                    ...getRecipientFieldFactory('avatar', initiatorId, 'whoCanSeeMyProfilePhotos'),
                                },
                            },
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
                $mergeObjects: [{ $first: '$conversation' }],
            },
        },
    },
    { $unset: ['conversation'] },
    { $unwind: { path: '$config', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 1, type: 1, lastActionAt: 1, item: 1, config_id: '$config._id' } },
];