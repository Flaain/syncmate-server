import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedConfig, FeedConfigSchema } from './schemas/feed.config.schema';
import { Feed, FeedSchema } from './schemas/feed.schema';

@Module({
    imports: [
        UserModule,
        MongooseModule.forFeature([
            { name: Feed.name, schema: FeedSchema },
            { name: FeedConfig.name, schema: FeedConfigSchema },
        ]),
        forwardRef(() => AuthModule),
    ],
    controllers: [FeedController],
    providers: [FeedService],
    exports: [FeedService],
})
export class FeedModule {}