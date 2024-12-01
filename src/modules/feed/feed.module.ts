import { Module, forwardRef } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { UserModule } from '../user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Feed, FeedSchema } from './schemas/feed.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [UserModule, MongooseModule.forFeature([{ name: Feed.name, schema: FeedSchema }]), forwardRef(() => AuthModule)],
    controllers: [FeedController],
    providers: [FeedService],
    exports: [FeedService],
})
export class FeedModule {}