import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IMessage, MessageRefPath } from '../types';

@Schema({ timestamps: true })
export class Message implements Omit<IMessage, '_id'> {
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'refPath' })
    sender: mongoose.Types.ObjectId;

    @Prop({ type: String, required: true })
    text: string;

    @Prop({ type: String, enum: MessageRefPath, required: true })
    refPath: MessageRefPath;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Message' })
    replyTo?: mongoose.Types.ObjectId;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message'}] })
    replies?: Array<mongoose.Types.ObjectId>;

    @Prop({ required: true, default: false })
    hasBeenRead?: boolean;

    @Prop({ required: true, default: false })
    hasBeenEdited?: boolean;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }] })
    attachments?: Array<mongoose.Types.ObjectId>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);