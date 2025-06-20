import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

@Schema({ collection: 'user_settings', timestamps: true })
export class UserSettings {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'privacy_settings', index: true, required: true })
    privacy_settings: mongoose.Types.ObjectId;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);