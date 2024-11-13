import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MessageSenderRefPath, MessageSourceRefPath } from '../types';

@Schema({ timestamps: true })
export class Message {
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'senderRefPath' })
    sender: mongoose.Types.ObjectId;

    @Prop({ type: String, enum: MessageSenderRefPath, required: true })
    senderRefPath: MessageSenderRefPath;

    @Prop({ type: String, required: true })
    text: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'sourceRefPath' })
    source: mongoose.Types.ObjectId;

    @Prop({ type: String, enum: MessageSourceRefPath, required: true })
    sourceRefPath: MessageSourceRefPath;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Message' })
    replyTo?: mongoose.Types.ObjectId;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message'}] })
    replies?: Array<mongoose.Types.ObjectId>;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Message' })
    forwardedFrom?: mongoose.Types.ObjectId;

    @Prop({ required: true, default: false })
    hasBeenRead?: boolean;

    @Prop({ required: true, default: false })
    hasBeenEdited?: boolean;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }] })
    attachments?: Array<mongoose.Types.ObjectId>;
    
    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);