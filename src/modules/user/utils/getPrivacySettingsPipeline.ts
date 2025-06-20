import { PipelineStage, Types } from 'mongoose';
import { getPrivacyFieldFactory } from './getPrivacyFieldFactory';

export const getPrivacySettingsPipeline = (settingsId: Types.ObjectId): Array<PipelineStage> => [
    { $match: { _id: settingsId } },
    {
        $lookup: {
            from: 'privacy_settings',
            localField: 'privacy_settings',
            foreignField: '_id',
            as: 'privacy_settings',
        },
    },
    { $unwind: { path: '$privacy_settings', preserveNullAndEmptyArrays: true } },
    {
        $project: {
            // TODO: find better way to return size for each privacy field
            _id: 1,
            ...getPrivacyFieldFactory('whoCanSeeMyEmail'),
            ...getPrivacyFieldFactory('whoCanSeeMyLastSeenTime'),
            ...getPrivacyFieldFactory('whoCanSeeMyProfilePhotos'),
            ...getPrivacyFieldFactory('whoCanSeeMyBio'),
            ...getPrivacyFieldFactory('whoCanLinkMyProfileViaForward'),
            ...getPrivacyFieldFactory('whoCanAddMeToGroupChats'),
            ...getPrivacyFieldFactory('whoCanSendMeMessages'),
        },
    },
];