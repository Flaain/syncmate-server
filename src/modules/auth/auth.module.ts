import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { CookiesModule } from 'src/utils/services/cookies/cookies.module';
import { BcryptModule } from 'src/utils/services/bcrypt/bcrypt.module';
import { UserModule } from '../user/user.module';
import { SessionModule } from '../session/session.module';
import { FeedModule } from '../feed/feed.module';
import { APP_GUARD } from '@nestjs/core';
import { AccessGuard } from './guards/auth.access.guard';
import { OtpModule } from '../otp/otp.module';

@Module({
    imports: [
        OtpModule,
        UserModule,
        CookiesModule,
        BcryptModule,
        SessionModule,
        FeedModule,
        JwtModule.registerAsync({
            global: true,
            useFactory: () => ({
                secret: process.env.ACCESS_TOKEN_SECRET,
                signOptions: {
                    expiresIn: process.env.ACCESS_TOKEN_EXPIRESIN,
                    audience: ['user'],
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, { provide: APP_GUARD, useClass: AccessGuard }],
    exports: [AuthService],
})
export class AuthModule {}