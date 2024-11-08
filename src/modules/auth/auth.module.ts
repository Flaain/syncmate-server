import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { CookiesModule } from 'src/utils/services/cookies/cookies.module';
import { BcryptModule } from 'src/utils/services/bcrypt/bcrypt.module';
import { UserModule } from '../user/user.module';
import { OtpModule } from '../otp/otp.module';
import { SessionModule } from '../session/session.module';

@Module({
    imports: [
        UserModule,
        CookiesModule,
        BcryptModule,
        OtpModule,
        SessionModule,
        JwtModule.registerAsync({
            global: true,
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
    providers: [AuthService],
})
export class AuthModule {}