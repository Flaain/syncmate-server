import mongoose from 'mongoose';
import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { InviteInterface } from '../types';
import { DatesService } from 'src/utils/services/dates/dates.service';

export class Invite implements InviteInterface {
    @Prop({ type: String, required: true })
    code: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true })
    groupId: mongoose.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true })
    createdBy: mongoose.Types.ObjectId;

    @Prop({ type: Date, expires: '7d' })
    createdAt: Date;

    @Prop({ type: Number, default: 0 })
    inviteAmount: number;

    @Prop({ type: Date, required: true, default: DatesService.oneWeekFromNow })
    expiresAt: Date;
}

export const InviteSchema = SchemaFactory.createForClass(Invite); 