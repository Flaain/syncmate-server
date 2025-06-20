import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedModule } from '../feed/feed.module';
import { GatewayModule } from '../gateway/gateway.module';
import { MessageModule } from '../message/message.module';
import { BlockList, BlockListSchema } from '../user/schemas/user.blocklist.schema';
import { UserModule } from '../user/user.module';
import { ConversationController } from './conversation.controller';
import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { ConversationSettings, ConversationSettingsSchema } from './schemas/conversation.settings.schema';

@Module({
    imports: [
        UserModule,
        FeedModule,
        MessageModule,
        GatewayModule,
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
            { name: ConversationSettings.name, schema: ConversationSettingsSchema },
            { name: BlockList.name, schema: BlockListSchema },
        ]),
    ],
    providers: [ConversationService, ConversationGateway],
    controllers: [ConversationController],
    exports: [ConversationService],
})
export class ConversationModule {}