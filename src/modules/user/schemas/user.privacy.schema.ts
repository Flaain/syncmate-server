import mongoose from 'mongoose';
import { Prop, PropOptions, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PrivacySetting } from '../types';

const getPrivacySettingOptions = (): PropOptions => ({
    type: {
        _id: { _id: false },
        mode: {
            type: Number,
            enum: [0, 1], // 0 - nobody, 1 - everybody
            required: true,
            default: 1,
        },
        deny: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'User',
            default: [],
        },
        allow: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'User',
            default: [],
        },
    },
    // index: true, <-- not sure about index
    default: () => ({}),
});

@Schema({ collection: 'privacy_settings', timestamps: true })
export class UserPrivacySettings {
    @Prop(getPrivacySettingOptions())
    whoCanSeeMyEmail: PrivacySetting;
    
    @Prop(getPrivacySettingOptions())
    whoCanSeeMyLastSeenTime: PrivacySetting;
    
    @Prop(getPrivacySettingOptions())
    whoCanSeeMyProfilePhotos: PrivacySetting;

    @Prop(getPrivacySettingOptions())
    whoCanSeeMyBio: PrivacySetting;

    @Prop(getPrivacySettingOptions())
    whoCanLinkMyProfileViaForward: PrivacySetting;

    @Prop(getPrivacySettingOptions())
    whoCanAddMeToGroupChats: PrivacySetting;
    
    @Prop(getPrivacySettingOptions())
    whoCanSendMeMessages: PrivacySetting;
}

export const UserPrivacySettingsSchema = SchemaFactory.createForClass(UserPrivacySettings);