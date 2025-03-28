import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { FeedModule } from '../feed/feed.module';
import { GatewayModule } from '../gateway/gateway.module';
import { MessageModule } from '../message/message.module';
import { BlockList, BlockListSchema } from '../user/schemas/user.blocklist.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { UserModule } from '../user/user.module';
import { ConversationController } from './conversation.controller';
import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';

@Module({
    imports: [
        UserModule,
        FeedModule,
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
            { name: User.name, schema: UserSchema },
            { name: BlockList.name, schema: BlockListSchema },
        ]),
        forwardRef(() => GatewayModule),
        forwardRef(() => AuthModule),
        forwardRef(() => MessageModule),
    ],
    providers: [ConversationService, ConversationGateway],
    controllers: [ConversationController],
    exports: [ConversationService],
})
export class ConversationModule {}