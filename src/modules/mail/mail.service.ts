import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { getOtpTemplate } from './templates';
import { OtpType } from '../otp/types';
import { titles } from './constants';

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService) {}

    sendOtpEmail = ({ otp, type, email }: { otp: number; type: OtpType; email: string }) => {
        return this.mailerService.sendMail({
            from: {
                name: 'FCHAT',
                address: process.env.MAILER_USER,
            },
            to: email,
            subject: 'Verification code',
            html: getOtpTemplate(otp, titles[type]),
        });
    };
}