import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GatewayManager } from './gateway.manager';
import { GatewayService } from './gateway.service';
import { UserModule } from '../user/user.module';
import { CookiesModule } from 'src/utils/services/cookies/cookies.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
    imports: [UserModule, ConversationModule, JwtModule, CookiesModule],
    providers: [GatewayService, GatewayManager],
})
export class GatewayModule {}