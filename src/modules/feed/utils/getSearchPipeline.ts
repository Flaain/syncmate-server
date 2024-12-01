import { PipelineStage } from 'mongoose';
import { FeedSearchParams } from '../types';

export const getSearchPipeline = ({ initiatorId, query, limit, page }: FeedSearchParams): Array<PipelineStage> => [
    {
        $facet: {
            data: [
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
                {
                    $unionWith: {
                        coll: 'groups',
                        pipeline: [
                            {
                                $match: {
                                    $or: [
                                        { login: { $regex: query, $options: 'i' } },
                                        { name: { $regex: query, $options: 'i' } },
                                    ],
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
            ],
        },
    },
    {
        $addFields: {
            meta: {
                total_items: { $size: '$data' },
                remaining_items: { $max: [{ $subtract: [{ $size: '$data' }, (page + 1) * limit] }, 0] },
                total_pages: { $ceil: { $divide: [{ $size: '$data' }, limit] } },
                current_page: page + 1,
                next_page: {
                    $cond: {
                        if: { $gt: [{ $ceil: { $divide: [{ $size: '$data' }, limit] } }, page + 1] },
                        then: page + 1,
                        else: null,
                    },
                },
            },
        },
    },
    { $project: { items: { $slice: ['$data', page * limit, limit] }, meta: 1 } },
];