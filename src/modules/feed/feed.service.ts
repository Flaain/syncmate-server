import { Model, Types } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { Pagination } from 'src/utils/types';
import { UserService } from '../user/user.service';
import { InjectModel } from '@nestjs/mongoose';
import { BaseService } from 'src/utils/services/base/base.service';
import { FeedDocument, GetFeedParams } from './types';
import { Feed } from './schemas/feed.schema';
import { feedMapper } from './constants';

@Injectable()
export class FeedService extends BaseService<FeedDocument, Feed> {
    constructor(
        private readonly userService: UserService,
        @InjectModel(Feed.name) private readonly feedModel: Model<FeedDocument>,
    ) {
        super(feedModel);
    }

    search = async ({ initiatorId, query, limit, page }: Pick<Pagination, 'query' | 'limit' | 'page'> & { initiatorId: Types.ObjectId }) => {
        return this.userService.aggregate([
            {
                $match: {
                    $or: [
                        { login: { $regex: query, $options: 'i' } },
                        { name: { $regex: query, $options: 'i' } },
                    ],
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
                                $or: [
                                    { login: { $regex: query, $options: 'i' } },
                                    { name: { $regex: query, $options: 'i' } },
                                ],
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
        ]);
    };
    

    getFeed = async ({ initiatorId, cursor }: GetFeedParams) => {
        const config = { limit: 10, nextCursor: null };

        const feed = await this.aggregate([
            { $match: { users: { $in: [initiatorId] }, ...(cursor && { lastActionAt: { $lt: cursor } }) } },
            { $sort: { lastActionAt: -1 } },
            { $limit: config.limit },
            feedMapper.Conversation.lookup(initiatorId),
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
            { $project: { _id: 1, type: 1, lastActionAt: 1, item: 1 } }
        ]);
    
        feed.length === config.limit && (config.nextCursor = feed[config.limit - 1].lastActionAt.toISOString());
    
        return { feed, nextCursor: config.nextCursor };
    };
    
}