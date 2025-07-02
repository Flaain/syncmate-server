import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OTP } from './schemas/otp.schema';
import { AppException } from 'src/utils/exceptions/app.exception';
import { OtpDocument, OtpType, OtpVerifyDTO } from './types';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import { BaseService } from 'src/utils/services/base/base.service';
import { defaultSuccessResponse } from 'src/utils/constants';

@Injectable()
export class OtpService extends BaseService<OtpDocument, OTP> {
    constructor(
        @InjectModel(OTP.name) private readonly otpModel: Model<OtpDocument>,
        private readonly userService: UserService,
        private readonly mailService: MailService
    ) {
        super(otpModel);
    }

    createOtp = async ({ email, type }: Pick<OTP, 'email' | 'type'>) => {
        const otpCheckHandlers: Record<Exclude<OtpType, 'email_change'>, () => Promise<void | { retryDelay: number }>> = {
            email_verification: async () => {
                if (await this.userService.exists({ email })) {
                    throw new AppException({ message: 'Cannot create OTP code' }, HttpStatus.CONFLICT);
                }
            },
            password_reset: async () => {
                if (!(await this.userService.exists({ email, isDeleted: false }))) {
                    return { retryDelay: 120000 };
                }
            },
        }; // rn it looks like overhead but i feel on distance it's a good approach for better scalability

        await otpCheckHandlers[type]()

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

        return defaultSuccessResponse;
    };
}