import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { UserModule } from '../user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Feed, FeedSchema } from './schemas/feed.schema';

@Module({
    imports: [UserModule, MongooseModule.forFeature([{ name: Feed.name, schema: FeedSchema }])],
    controllers: [FeedController],
    providers: [FeedService],
    exports: [FeedService],
})
export class FeedModule {}