import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { FileModule } from '../file/file.module';
import { BlockList, BlockListSchema } from './schemas/user.blocklist.schema';
import { UserSettings, UserSettingsSchema } from './schemas/user.settings.schema';
import { UserPrivacySettings, UserPrivacySettingsSchema } from './schemas/user.privacy.schema';

@Module({
    imports: [
        FileModule,
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: UserSettings.name, schema: UserSettingsSchema },
            { name: UserPrivacySettings.name, schema: UserPrivacySettingsSchema },
            { name: BlockList.name, schema: BlockListSchema },
        ]),
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}