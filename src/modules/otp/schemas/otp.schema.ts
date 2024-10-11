import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IOtp, OtpType } from '../types';
import { DatesService } from 'src/utils/services/dates/dates.service';

@Schema({ collection: 'otp_codes', timestamps: true })
export class OTP implements IOtp {
    @Prop({ type: String, required: true })
    email: string;

    @Prop({ type: Number, required: true })
    otp: number;

    @Prop({ type: String, enum: OtpType, required: true })
    type: OtpType;

    @Prop({ type: Date, expires: '2m' })
    createdAt?: Date;

    @Prop({ type: Date, required: true, default: DatesService.twoMinutesFromNow })
    expiresAt?: Date;
}

export const OtpSchema = SchemaFactory.createForClass(OTP);