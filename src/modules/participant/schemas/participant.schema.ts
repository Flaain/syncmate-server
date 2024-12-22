import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ParticipantRole } from '../types';

@Schema({ timestamps: true })
export class Participant {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true })
    group: mongoose.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
    user: mongoose.Types.ObjectId;

    @Prop({ type: String, enum: ParticipantRole, required: true, default: ParticipantRole.PARTICIPANT })
    role: ParticipantRole;
}

export const ParticipantSchema = SchemaFactory.createForClass(Participant);