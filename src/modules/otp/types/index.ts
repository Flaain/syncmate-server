import { z } from 'zod';
import { SchemaTimestampsConfig } from 'mongoose';
import { otpCreateSchema } from '../schemas/otp.create.schema';
import { Document } from 'mongoose';
import { otpVerifySchema } from '../schemas/otp.verify.schema';

export enum OtpType {
    EMAIL_VERIFICATION = 'email_verification',
    EMAIL_CHANGE = 'email_change',
    PASSWORD_RESET = 'password_reset',
}

export interface IOtp {
    email: string;
    otp: number;
    type: OtpType;
    expiresAt?: Date;
    createdAt?: Date;
}

export type OtpDocument = IOtp & Document & SchemaTimestampsConfig;

export type OtpCreateDTO = z.infer<typeof otpCreateSchema>;
export type OtpVerifyDTO = z.infer<typeof otpVerifySchema>;