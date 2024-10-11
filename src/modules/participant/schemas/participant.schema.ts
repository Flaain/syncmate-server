import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Participant {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true })
    group: mongoose.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
    user: mongoose.Types.ObjectId;
}

export const ParticipantSchema = SchemaFactory.createForClass(Participant);