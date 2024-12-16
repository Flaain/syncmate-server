import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { InjectModel } from '@nestjs/mongoose';
import { BaseService } from 'src/utils/services/base/base.service';
import { FeedDocument, GetFeedParams } from './types';
import { Feed } from './schemas/feed.schema';
import { getFeedPipeline } from './utils/getFeedPipeline';
import { SearchPipelineParams } from 'src/utils/types';
import { getSearchPipeline } from 'src/utils/helpers/getSearchPipeline';

@Injectable()
export class FeedService extends BaseService<FeedDocument, Feed> {
    constructor(
        private readonly userService: UserService,
        @InjectModel(Feed.name) private readonly feedModel: Model<FeedDocument>,
    ) {
        super(feedModel);
    }

    search = async ({ limit, page, query, initiatorId }: Omit<SearchPipelineParams, 'pipeline'>) => {
        const result = (await this.userService.aggregate(getSearchPipeline({
            limit,
            page,
            pipeline: [
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
            ] 
        })))[0];

        return result;
    };

    getFeed = async ({ initiatorId, cursor }: GetFeedParams) => {
        const config = { limit: 10, nextCursor: null };

        const feed = await this.aggregate(getFeedPipeline({ initiatorId, limit: config.limit, cursor }));
    
        feed.length === config.limit && (config.nextCursor = feed[config.limit - 1].lastActionAt.toISOString());
    
        return { feed, nextCursor: config.nextCursor };
    };
    
}