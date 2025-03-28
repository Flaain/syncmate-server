import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ConversationModule } from '../conversation/conversation.module';
import { FeedModule } from '../feed/feed.module';
import { BlockList, BlockListSchema } from '../user/schemas/user.blocklist.schema';
import { UserModule } from '../user/user.module';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { Message, MessageSchema } from './schemas/message.schema';

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