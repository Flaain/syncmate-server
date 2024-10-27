import { PipelineStage } from 'mongoose';
import { FeedSearchParams } from '../types';

export const getSearchPipeline = ({ initiatorId, query, limit, page }: FeedSearchParams): Array<PipelineStage> => [
    {
        $match: {
            $or: [{ login: { $regex: query, $options: 'i' } }, { name: { $regex: query, $options: 'i' } }],
            _id: { $ne: initiatorId },
            isDeleted: false,
            isPrivate: false,
        },
    },
    {
        $lookup: {
            from: 'files',
            localField: 'avatar',
            foreignField: '_id',
            as: 'avatar',
        },
    },
    {
        $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true },
    },
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
    {
        $unionWith: {
            coll: 'groups',
            pipeline: [
                {
                    $match: {
                        $or: [{ login: { $regex: query, $options: 'i' } }, { name: { $regex: query, $options: 'i' } }],
                        isPrivate: false,
                    },
                },
                {
                    $lookup: {
                        from: 'files',
                        localField: 'avatar',
                        foreignField: '_id',
                        as: 'avatar',
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
                        type: { $literal: 'Group' },
                    },
                },
            ],
        },
    },
    { $sort: { createdAt: -1 } },
    { $skip: page * limit },
    { $limit: limit },
];