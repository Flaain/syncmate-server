import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { Conversation, ConversationSchema } from '../conversation/schemas/conversation.schema';
import { FileModule } from '../file/file.module';
import { BlockList, BlockListSchema } from './schemas/user.blocklist.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        FileModule,
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Conversation.name, schema: ConversationSchema },
            { name: BlockList.name, schema: BlockListSchema },
        ]),
        forwardRef(() => AuthModule),
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}