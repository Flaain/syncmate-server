import { OtpType } from 'src/modules/otp/types';

export const titles: Record<OtpType, string> = {
    password_reset: 'Password Reset',
    email_verification: 'Confirm your email address',
    email_change: 'Confirm change of email address',
};