import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { InjectModel } from '@nestjs/mongoose';
import { BaseService } from 'src/utils/services/base/base.service';
import { FeedDocument, FeedSearchParams, GetFeedParams } from './types';
import { Feed } from './schemas/feed.schema';
import { getFeedPipeline } from './utils/getFeedPipeline';
import { getSearchPipeline } from './utils/getSearchPipeline';

@Injectable()
export class FeedService extends BaseService<FeedDocument, Feed> {
    constructor(
        private readonly userService: UserService,
        @InjectModel(Feed.name) private readonly feedModel: Model<FeedDocument>,
    ) {
        super(feedModel);
    }

    search = async (params: FeedSearchParams) => {
        const result = (await this.userService.aggregate(getSearchPipeline(params)))[0];

        return result;
    };

    getFeed = async ({ initiatorId, cursor }: GetFeedParams) => {
        const config = { limit: 10, nextCursor: null };

        const feed = await this.aggregate(getFeedPipeline({ initiatorId, limit: config.limit, cursor }));
    
        feed.length === config.limit && (config.nextCursor = feed[config.limit - 1].lastActionAt.toISOString());
    
        return { feed, nextCursor: config.nextCursor };
    };
    
}