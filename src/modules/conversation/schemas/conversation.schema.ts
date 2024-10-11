import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IConversation } from '../types';

@Schema({ timestamps: true })
export class Conversation implements Omit<IConversation, '_id'> {
    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] })
    participants: Array<mongoose.Types.ObjectId>;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }] })
    messages?: Array<mongoose.Types.ObjectId>;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Message' })
    lastMessage?: mongoose.Types.ObjectId;

    @Prop({ type: Date, required: true, default: () => new Date() })
    lastMessageSentAt?: Date;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);