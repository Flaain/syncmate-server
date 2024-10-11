import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { getOtpTemplate } from './templates';
import { OtpType } from '../otp/types';

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService) {}

    private readonly titles: Record<OtpType, string> = {
        password_reset: 'Password Reset',
        email_verification: 'Confirm your email address',
        email_change: 'Confirm change of email address',
    };

    sendOtpEmail = ({ otp, type, email }: { otp: number; type: OtpType; email: string }) => {
        return this.mailerService.sendMail({
            from: {
                name: 'FCHAT',
                address: process.env.MAILER_USER,
            },
            to: email,
            subject: 'Verification code',
            html: getOtpTemplate(otp, this.titles[type]),
        });
    };
}