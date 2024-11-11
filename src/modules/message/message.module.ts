import { Module, forwardRef } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { ConversationModule } from '../conversation/conversation.module';
import { UserModule } from '../user/user.module';
import { FeedModule } from '../feed/feed.module';
import { BlockList, BlockListSchema } from '../user/schemas/user.blocklist.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        FeedModule,
        UserModule,
        MongooseModule.forFeature([
            { name: Message.name, schema: MessageSchema },
            { name: BlockList.name, schema: BlockListSchema },
        ]),
        forwardRef(() => ConversationModule),
        forwardRef(() => AuthModule)
    ],
    providers: [MessageService],
    controllers: [MessageController],
    exports: [MessageService],
})
export class MessageModule {}