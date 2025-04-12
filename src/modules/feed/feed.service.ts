import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, CreateOptions, InsertManyOptions, Model, RootFilterQuery, Types } from 'mongoose';
import { getSearchPipeline } from 'src/utils/helpers/getSearchPipeline';
import { BaseService } from 'src/utils/services/base/base.service';
import { SearchPipelineParams } from 'src/utils/types';
import { UserService } from '../user/user.service';
import { FeedConfig } from './schemas/feed.config.schema';
import { Feed } from './schemas/feed.schema';
import { FeedConfigDocument, FeedDocument, GetFeedParams } from './types';
import { getFeedPipeline, getFeedSearchPipeline } from './utils/getFeedPipeline';

@Injectable()
export class FeedService extends BaseService<FeedDocument, Feed> {
    constructor(
        private readonly userService: UserService,
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Feed.name) private readonly feedModel: Model<FeedDocument>,
        @InjectModel(FeedConfig.name) private readonly feedConfigModel: Model<FeedConfigDocument>,
    ) {
        super(feedModel);
    }

    search = async ({ limit, page, query, initiatorId }: Omit<SearchPipelineParams, 'pipeline'>) => {
        const result = (await this.userService.aggregate(getSearchPipeline({ limit, page, pipeline: getFeedSearchPipeline({ initiatorId, query }) })))[0];

        return result;
    };

    getFeed = async ({ initiatorId, cursor }: GetFeedParams) => {
        const config = { limit: 10, nextCursor: null };

        const ids: Array<Types.ObjectId> = await this.feedConfigModel.find({ userId: initiatorId, is_archived: false }, { _id: 1 });

        if (!ids.length) return { feed: [], nextCursor: null };

        const feed = await this.aggregate(getFeedPipeline({ initiatorId, ids: ids.map((id) => id._id), limit: config.limit, cursor }));

        feed.length === config.limit && (config.nextCursor = feed[config.limit - 1].lastActionAt.toISOString());

        return { feed, nextCursor: config.nextCursor };
    };

    createConfig = async (doc: FeedConfigDocument, options?: CreateOptions) => this.feedConfigModel.create([doc], options);
    createConfigs = async (docs: Array<FeedConfig>, options?: InsertManyOptions) => this.feedConfigModel.insertMany(docs, options);
    deleteConfigs = async (filter: RootFilterQuery<FeedConfigDocument>, options?: any) => this.feedConfigModel.deleteMany(filter, options); 
}