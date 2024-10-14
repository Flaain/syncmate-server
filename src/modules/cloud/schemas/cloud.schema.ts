import mongoose from 'mongoose';
import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Cloud {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
    user: mongoose.Types.ObjectId;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId }], ref: 'Message' })
    messages: Array<mongoose.Types.ObjectId>;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Message' })
    lastMessage?: mongoose.Types.ObjectId;
}