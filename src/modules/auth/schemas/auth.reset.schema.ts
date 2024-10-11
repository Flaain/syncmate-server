import { z } from 'zod';
import { emailForSchema, passwordForSchema } from 'src/utils/constants';

export const authResetSchema = z.strictObject({
    email: emailForSchema,
    otp: z.string().min(6, 'Invalid OTP code').max(6, 'Invalid OTP code'),
    password: passwordForSchema,
});