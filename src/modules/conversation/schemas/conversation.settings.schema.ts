import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'conversation_settings', timestamps: true })
export class ConversationSettings {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true })
    user: mongoose.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true })
    conversation: mongoose.Types.ObjectId;

    @Prop({ type: Boolean, default: false })
    isMuted?: boolean;

    @Prop({ type: String })
    recipientName?: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'File' })
    bgChat?: mongoose.Types.ObjectId;
    
    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export const ConversationSettingsSchema = SchemaFactory.createForClass(ConversationSettings);