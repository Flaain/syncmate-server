import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { OtpType } from '../otp/types';
import { titles } from './constants';
import { getOtpTemplate } from './templates';

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService) {}

    sendOtpEmail = ({ otp, type, email }: { otp: number; type: OtpType; email: string }) => this.mailerService.sendMail({
        from: 'Syncmate',
        to: email,
        subject: 'Verification code',
        html: getOtpTemplate(otp, titles[type])
    });
}