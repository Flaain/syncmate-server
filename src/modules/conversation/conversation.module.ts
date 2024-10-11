import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user/user.module';
import { ParticipantModule } from '../participant/participant.module';
import { Message, MessageSchema } from '../message/schemas/message.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { FeedModule } from '../feed/feed.module';

@Module({
    imports: [
        UserModule,
        ParticipantModule,
        FeedModule,
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
            { name: Message.name, schema: MessageSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    providers: [ConversationService],
    controllers: [ConversationController],
    exports: [ConversationService],
})
export class ConversationModule {}