import { PipelineStage, Types } from 'mongoose';
import { FEED_TYPE } from '../types';
export const feedMapper: Record<FEED_TYPE, { lookup: (initiatorId: Types.ObjectId) => PipelineStage }> = {
    Conversation: {
        lookup: (initiatorId) => ({
            $lookup: {
                from: 'conversations',
                localField: 'item',
                foreignField: '_id',
                as: '_temporaryConversation',
                pipeline: [
                    { 
                        $lookup: { 
                            from: 'users', 
                            localField: 'participants',
                            foreignField: '_id',
                            pipeline: [
                                { $match: { $expr: { $ne: ['$_id', initiatorId] } } }, 
                                { $lookup: { from: 'files', localField: 'avatar', foreignField: '_id', as: 'avatar', pipeline: [{ $project: { _id: 1, url: 1 } }] } }, 
                                { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } }, 
                                { $project: { login: 1, name: 1, isOfficial: 1, isDeleted: 1, presence: 1, avatar: 1 } }
                            ], 
                            as: 'participants' 
                        } 
                    },
                    { 
                        $lookup: { 
                            from: 'messages', 
                            localField: 'lastMessage', 
                            foreignField: '_id', 
                            as: 'lastMessage',
                            pipeline: [
                                { 
                                    $lookup: { 
                                        from: 'users', 
                                        localField: 'sender', 
                                        foreignField: '_id', 
                                        as: 'sender',
                                        pipeline: [{ $project: { _id: 1, name: 1 } }] 
                                    }
                                },
                                { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                                { $project: { _id: 1, text: 1, createdAt: 1, sender: 1 } }
                            ]
                        } 
                    },
                    { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
                    { $project: { _id: 1, lastMessage: 1, recipient: { $first: '$participants' } } }
                ],
            },
        }),
    },
    Group: { lookup: () => ({ $lookup: { from: 'groups', localField: 'item', as: '#' } }) },
    Cloud: { lookup: () => ({ $lookup: { from: 'groups', localField: 'item', as: '#' } }) },
};