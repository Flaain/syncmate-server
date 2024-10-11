import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OTP } from './schemas/otp.schema';
import { AppException } from 'src/utils/exceptions/app.exception';
import { IOtpService, OtpDocument, OtpType } from './types';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { OtpVerifyDTO } from './dtos/otp.verify.dto';
import { BaseService } from 'src/utils/services/base/base.service';

@Injectable()
export class OtpService extends BaseService<OtpDocument, OTP> implements IOtpService {
    constructor(
        @InjectModel(OTP.name) private readonly otpModel: Model<OtpDocument>,
        private readonly userService: UserService,
        private readonly mailService: MailService
    ) {
        super(otpModel);
    }

    createOtp = async ({ email, type }: Pick<OTP, 'email' | 'type'>) => {
        if (type === OtpType.EMAIL_VERIFICATION && await this.userService.exists({ email })) {
            throw new AppException({ message: 'Cannot create OTP code' }, HttpStatus.CONFLICT);
        }

        const otpExists = await this.findOne({ filter: { email, type }, projection: { expiresAt: 1 } });

        if (otpExists && new Date(otpExists.expiresAt).getTime() > Date.now()) {
            return { retryDelay: new Date(otpExists.expiresAt).getTime() - Date.now() };
        }

        const generatedOTP = Math.floor(100000 + Math.random() * 900000);

        const otp = await this.create({ email, otp: generatedOTP, type });

        await this.mailService.sendOtpEmail({ otp: generatedOTP, type, email });

        return { retryDelay: new Date(otp.expiresAt).getTime() - Date.now() };
    };

    verify = async ({ otp, email, type }: OtpVerifyDTO) => {
        if (!await this.exists({ otp, email, type })) {
            throw new AppException({
                message: 'Invalid OTP code',
                errors: [{ path: 'otp', message: 'Invalid OTP code' }]
            }, HttpStatus.BAD_REQUEST);
        }

        return { message: 'OK', statusCode: HttpStatus.OK }
    };
}