import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { CookiesModule } from 'src/utils/services/cookies/cookies.module';
import { BcryptModule } from 'src/utils/services/bcrypt/bcrypt.module';
import { UserModule } from '../user/user.module';
import { OtpModule } from '../otp/otp.module';
import { SessionModule } from '../session/session.module';
import { AuthAccessStrategy } from './strategies/auth.access.strategy';
import { AuthRefreshStrategy } from './strategies/auth.refresh.strategy';

@Module({
    imports: [
        UserModule,
        PassportModule,
        CookiesModule,
        BcryptModule,
        OtpModule,
        SessionModule,
        PassportModule.register({ defaultStrategy: 'jwt', property: 'user' }),
        JwtModule.registerAsync({
            useFactory: () => {
                return {
                    secret: process.env.ACCESS_TOKEN_SECRET,
                    signOptions: {
                        expiresIn: process.env.ACCESS_TOKEN_EXPIRESIN,
                        audience: ['user'],
                    },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthAccessStrategy, AuthRefreshStrategy],
})
export class AuthModule {}