import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user/user.module';
import { ParticipantModule } from '../participant/participant.module';
import { User, UserSchema } from '../user/schemas/user.schema';
import { FeedModule } from '../feed/feed.module';
import { AuthModule } from '../auth/auth.module';
import { MessageModule } from '../message/message.module';
import { BlockList, BlockListSchema } from '../user/schemas/user.blocklist.schema';

@Module({
    imports: [
        UserModule,
        ParticipantModule,
        FeedModule,
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
            { name: User.name, schema: UserSchema },
            { name: BlockList.name, schema: BlockListSchema },
        ]),
        forwardRef(() => AuthModule),
        forwardRef(() => MessageModule),
    ],
    providers: [ConversationService],
    controllers: [ConversationController],
    exports: [ConversationService],
})
export class ConversationModule {}