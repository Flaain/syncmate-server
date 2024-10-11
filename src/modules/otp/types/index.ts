import { z } from 'zod';
import { SchemaTimestampsConfig } from 'mongoose';
import { OtpCreateSchema } from '../schemas/otp.create.schema';
import { Document } from 'mongoose';

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

export interface IOtpService {
    createOtp: (dto: Pick<IOtp, 'email' | 'type'>) => Promise<{ retryDelay?: number }>;
}

export interface IOtpController {
    create: (dto: z.infer<typeof OtpCreateSchema>) => Promise<{ retryDelay?: number }>;
}