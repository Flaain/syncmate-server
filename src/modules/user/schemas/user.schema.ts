import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PRESENCE } from '../types';
import { ROLES } from 'src/modules/auth/types';

@Schema({ timestamps: true })
export class User {
    @Prop({ type: String, required: true, unique: true })
    login: string;

    @Prop({ type: String, required: true })
    name: string;

    @Prop({ type: String })
    lastName?: string;

    @Prop({ type: String, required: true, unique: true })
    email: string;

    @Prop({ type: String, required: true })
    password: string;

    @Prop({ type: Date, required: true })
    birthDate: Date;

    @Prop({ type: String, enum: ROLES, required: true, default: ROLES.USER })
    role?: ROLES

    @Prop({ type: Boolean, required: true, default: false })
    isPrivate?: boolean;

    @Prop({ type: String, enum: PRESENCE, required: true, default: PRESENCE.OFFLINE })
    presence?: PRESENCE;

    @Prop({ type: Boolean, required: true, default: false })
    isOfficial?: boolean;

    @Prop({ type: Date, required: true, default: () => new Date() })
    lastSeenAt?: Date;

    @Prop({ type: Boolean, default: false })
    isDeleted?: boolean;

    @Prop({ type: String })
    bio?: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'File' })
    avatar?: mongoose.Types.ObjectId;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);