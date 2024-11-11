import { Module, forwardRef } from '@nestjs/common';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './schemas/group.schema';
import { ParticipantModule } from '../participant/participant.module';
import { UserModule } from '../user/user.module';
import { InviteModule } from '../invite/invite.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        ParticipantModule,
        UserModule,
        InviteModule,
        MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]),
        forwardRef(() => AuthModule)
    ],
    controllers: [GroupController],
    providers: [GroupService],
    exports: [GroupService],
})
export class GroupModule {}