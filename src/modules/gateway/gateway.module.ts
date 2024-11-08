import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { CookiesModule } from 'src/utils/services/cookies/cookies.module';
import { ConversationModule } from '../conversation/conversation.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [ConversationModule, AuthModule, CookiesModule],
    providers: [GatewayService],
    exports: [GatewayService],
})
export class GatewayModule {}