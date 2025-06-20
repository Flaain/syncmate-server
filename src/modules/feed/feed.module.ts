import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user/user.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedConfig, FeedConfigSchema } from './schemas/feed.config.schema';
import { Feed, FeedSchema } from './schemas/feed.schema';
import { SessionModule } from '../session/session.module';

@Module({
    imports: [
        UserModule,
        SessionModule,
        MongooseModule.forFeature([
            { name: Feed.name, schema: FeedSchema },
            { name: FeedConfig.name, schema: FeedConfigSchema },
        ]),
    ],
    controllers: [FeedController],
    providers: [FeedService],
    exports: [FeedService],
})
export class FeedModule {}