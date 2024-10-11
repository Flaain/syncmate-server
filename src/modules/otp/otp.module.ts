import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OTP, OtpSchema } from './schemas/otp.schema';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [MailModule, MongooseModule.forFeature([{ name: OTP.name, schema: OtpSchema }]), UserModule],
    controllers: [OtpController],
    providers: [OtpService],
    exports: [OtpService],
})
export class OtpModule {}