import { PipelineStage } from "mongoose";
import { GetFeedPipelineParams } from "../types";

export const getFeedPipeline = ({ initiatorId, cursor, limit = 10 }: GetFeedPipelineParams): Array<PipelineStage> => [
    { $match: { users: { $in: [initiatorId] }, ...(cursor && { lastActionAt: { $lt: new Date(cursor) } }) } },
    { $sort: { lastActionAt: -1 } },
    { $limit: limit },
    {
        $lookup: {
            from: 'conversations',
            localField: 'item',
            foreignField: '_id',
            as: '_temporaryConversation',
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
                            { $project: { login: 1, name: 1, isOfficial: 1, isDeleted: 1, presence: 1, avatar: 1 } },
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
                        ]
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
                { $project: { _id: 1, lastMessage: 1, unreadMessages: { $first: '$unreadMessages.unreadMessages' }, recipient: { $first: '$participants' } } },
            ],
        },
    },
    // { $lookup: { from: 'groups', localField: 'item', foreignField: '_id', as: '#' } },
    // { $lookup: { from: 'clouds', localField: 'item', foreignField: '_id', as: '#' } },
    {
        $set: {
            item: {
                $mergeObjects: [
                    { $first: '$_temporaryConversation' },
                    { $first: '$_temporaryGroup' },
                    { $first: '$_temporaryCloud' },
                ],
            },
        },
    },
    { $unset: ['_temporaryConversation', '_temporaryGroup', '_temporaryCloud'] },
    { $project: { _id: 1, type: 1, lastActionAt: 1, item: 1 } },
];