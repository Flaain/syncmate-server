import { z } from 'zod';
import { emailForSchema, otpForSchema, passwordForSchema } from 'src/utils/constants';

export const authResetSchema = z.strictObject({
    email: emailForSchema,
    otp: otpForSchema,
    password: passwordForSchema,
});