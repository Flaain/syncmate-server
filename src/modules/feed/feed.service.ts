import { Model, Types } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { GroupService } from '../group/group.service';
import { Pagination } from 'src/utils/types';
import { UserService } from '../user/user.service';
import { InjectModel } from '@nestjs/mongoose';
import { BaseService } from 'src/utils/services/base/base.service';
import { FeedDocument, GetFeedParams } from './types';
import { Feed } from './schemas/feed.schema';
import { feedHandlers } from './constants';

@Injectable()
export class FeedService extends BaseService<FeedDocument, Feed> {
    constructor(
        private readonly userService: UserService,
        private readonly groupService: GroupService,
        @InjectModel(Feed.name) private readonly feedModel: Model<FeedDocument>,
    ) {
        super(feedModel);
    }

    search = async ({ initiatorId, query }: Pick<Pagination, 'query'> & { initiatorId: Types.ObjectId }) => {
        return Promise.all([
            this.userService.find({
                filter: {
                    $or: [{ login: { $regex: query, $options: 'i' } }, { name: { $regex: query, $options: 'i' } }],
                    _id: { $ne: initiatorId },
                    isDeleted: false,
                    isPrivate: false,
                },
                projection: { _id: 1, name: 1, login: 1, isOfficial: 1 },
                options: { populate: { path: 'avatar', model: 'File', select: 'url' }, sort: { createdAt: -1 } },
            }),
            this.groupService.find({
                filter: {
                    $or: [{ login: { $regex: query, $options: 'i' } }, { name: { $regex: query, $options: 'i' } }],
                    isPrivate: false,
                },
                projection: { _id: 1, name: 1, login: 1, isOfficial: 1 },
                options: { populate: { path: 'avatar', model: 'File', select: 'url' }, sort: { createdAt: -1 } },
            }),
        ]);
    };

    getFeed = async ({ initiatorId, cursor }: GetFeedParams) => {
        const config = { limit: 10, nextCursor: null };

        const feed = await this.find({
            filter: { users: { $in: initiatorId }, ...(cursor && { lastActionAt: { $lt: cursor } }) },
            projection: { item: 1, type: 1, lastActionAt: 1 },
            options: { limit: config.limit, sort: { lastActionAt: -1 } },
        });

        const populatedFeed = await Promise.all(feed.map(async (item: FeedDocument) => {
            const itemHandlers = feedHandlers[item.type];
            const populatedItem = await item.populate(itemHandlers.populate(initiatorId));

            return itemHandlers.returnObject(populatedItem.toObject());
        }));

        feed.length === config.limit && (config.nextCursor = feed[config.limit - 1].lastActionAt.toISOString());

        return { feed: populatedFeed, nextCursor: config.nextCursor };
    };
}