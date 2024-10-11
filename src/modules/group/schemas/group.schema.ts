import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IGroup } from '../types';

@Schema({ timestamps: true })
export class Group implements IGroup {
    @Prop({ type: String, required: true, unique: true })
    login: string;

    @Prop({ type: String, required: true, unique: false })
    name: string;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Participant' }] })
    participants?: Array<mongoose.Types.ObjectId>;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage' }] })
    messages?: Array<mongoose.Types.ObjectId>;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage' })
    lastMessage?: mongoose.Types.ObjectId;

    @Prop({ type: Date, required: true, default: () => new Date() })
    lastMessageSentAt?: Date;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true })
    owner: mongoose.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'File' })
    avatar?: mongoose.Types.ObjectId;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invite' }] })
    invites?: Array<mongoose.Types.ObjectId>;

    @Prop({ type: Boolean, default: false })
    isPrivate?: boolean;

    @Prop({ type: Boolean, default: false })
    isOfficial?: boolean;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export const GroupSchema = SchemaFactory.createForClass(Group);