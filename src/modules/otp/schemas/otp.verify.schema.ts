import { emailForSchema } from "src/utils/constants";
import { z } from "zod";
import { OtpType } from "../types";

export const otpVerifySchema = z.strictObject({
    email: emailForSchema,
    otp: z.string().min(6, 'Invalid OTP code').max(6, 'Invalid OTP code'),
    type: z.enum([OtpType.EMAIL_VERIFICATION, OtpType.PASSWORD_RESET])
})