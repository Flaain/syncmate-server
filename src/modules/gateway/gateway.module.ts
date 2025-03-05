import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { CookiesModule } from 'src/utils/services/cookies/cookies.module';
import { ConversationModule } from '../conversation/conversation.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { GroupModule } from '../group/group.module';
import { ParticipantModule } from '../participant/participant.module';

@Module({
    imports: [ConversationModule, AuthModule, CookiesModule, UserModule, GroupModule, ParticipantModule],
    providers: [GatewayService],
    exports: [GatewayService],
})
export class GatewayModule {}