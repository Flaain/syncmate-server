import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { CookiesModule } from 'src/utils/services/cookies/cookies.module';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [AuthModule, CookiesModule, ConfigModule],
    providers: [GatewayService],
    exports: [GatewayService],
})
export class GatewayModule {}