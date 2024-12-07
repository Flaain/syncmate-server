import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { ConversationDocument } from './types';
import { AppException } from 'src/utils/exceptions/app.exception';
import { UserService } from '../user/user.service';
import { UserDocument } from '../user/types';
import { BaseService } from 'src/utils/services/base/base.service';
import { MESSAGES_BATCH } from './constants';
import { Providers } from 'src/utils/types';
import { S3Client } from '@aws-sdk/client-s3';
import { FeedService } from '../feed/feed.service';
import { MessageService } from '../message/message.service';
import { BlockList } from '../user/schemas/user.blocklist.schema';

@Injectable()
export class ConversationService extends BaseService<ConversationDocument, Conversation> {
    constructor(
        @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
        @Inject(Providers.S3_CLIENT) private readonly s3: S3Client,
        @Inject(forwardRef(() => MessageService)) private readonly messageService: MessageService,
        @InjectModel(BlockList.name) private readonly blocklistModel: Model<BlockList>,
        private readonly feedService: FeedService,
        private readonly userService: UserService,
    ) {
        super(conversationModel);
    }

    deleteConversation = async ({ initiatorId, recipientId }: { initiatorId: Types.ObjectId; recipientId: string }) => {
        const recipient = await this.userService.findOne({
            filter: { _id: recipientId },
            projection: { birthDate: 0, password: 0, isPrivate: 0 },
        });
        
        if (!recipient) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);

        const conversation = await this.findOne({ filter: { participants: { $all: [initiatorId, recipient._id] } } });

        if (!conversation) throw new AppException({ message: 'Conversation not found' }, HttpStatus.NOT_FOUND);

        await Promise.all([
            this.messageService.deleteMany({ _id: { $in: conversation.messages } }), 
            this.feedService.findOneAndDelete({ users: { $all: [initiatorId, recipientId] }, item: conversation._id }),
            conversation.deleteOne(),
        ]);

        return { _id: conversation._id, recipientId: recipient._id.toString() };
    };
    
    getConversation = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        let nextCursor: string | null = null;
        
        const recipient = await this.userService.getRecipient(recipientId);

        const { 0: { isInitiatorBlocked, isRecipientBlocked } } = await this.blocklistModel.aggregate([
            {
                $facet: {
                    isInitiatorBlocked: [
                        { $match: { user: recipient._id, $expr: { $in: [initiator._id, { $ifNull: ['$blocklist', []] }] } } },
                        { $project: { isBlocked: { $literal: true } } },
                    ],
                    isRecipientBlocked: [
                        { $match: { user: initiator._id, $expr: { $in: [recipient._id, { $ifNull: ['$blocklist', []] }] } } },
                        { $project: { isBlocked: { $literal: true } } }
                    ],
                },
            },
            { 
                $project: { 
                    isInitiatorBlocked: { $first: '$isInitiatorBlocked.isBlocked' }, 
                    isRecipientBlocked: { $first: '$isRecipientBlocked.isBlocked' } 
                } 
            },
        ]);
        
        const conversation = (await this.aggregate([
            { $match: { participants: { $all: [initiator._id, recipient._id] } } },
            {
                $lookup: {
                    from: 'messages',
                    localField: 'messages',
                    foreignField: '_id',
                    as: 'messages',
                    pipeline: [
                        { $sort: { createdAt: -1 } },
                        { $limit: MESSAGES_BATCH },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'sender',
                                foreignField: '_id',
                                as: 'sender',
                                pipeline: [
                                    { $project: { name: 1, isDeleted: 1, avatar: 1 } },
                                    {
                                        $lookup: {
                                            from: 'files',
                                            localField: 'avatar',
                                            foreignField: '_id',
                                            as: 'avatar',
                                            pipeline: [{ $project: { url: 1 } }],
                                        },
                                    },
                                    { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                                ],
                            },
                        },
                        {
                            $lookup: {
                                from: 'messages',
                                localField: 'replyTo',
                                foreignField: '_id',
                                as: 'replyTo',
                                pipeline: [
                                    {
                                        $lookup: {
                                            from: 'users',
                                            localField: 'sender',
                                            foreignField: '_id',
                                            as: 'sender',
                                            pipeline: [{ $project: { name: 1 } }],
                                        },
                                    },
                                    { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                                    { $project: { text: 1, sender: 1 } }
                                ],
                            },
                        },
                        { $unwind: { path: '$replyTo', preserveNullAndEmptyArrays: true } },
                        { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                        { $project: { source: 0, sourceRefPath: 0 } },
                    ],
                },
            },
            { $project: { messages: 1 } },
        ]))[0];

        conversation?.messages.length === MESSAGES_BATCH && (nextCursor = conversation?.messages[MESSAGES_BATCH - 1]._id.toString());
        conversation?.messages.reverse();

        return { conversation: { ...(conversation || { messages: [] }), recipient, isInitiatorBlocked, isRecipientBlocked }, nextCursor };
    };

    getPreviousMessages = async ({ cursor, initiator, recipientId }: { cursor: string, initiator: UserDocument, recipientId: string }) => {        
        let nextCursor: string | null = null;

        const conversation = (await this.aggregate([
            { $match: { participants: { $all: [initiator._id, new Types.ObjectId(recipientId)] } } },
            {
                $lookup: {
                    from: 'messages',
                    localField: 'messages',
                    foreignField: '_id',
                    as: 'messages',
                    pipeline: [
                        { $match: { _id: { $lt: new Types.ObjectId(cursor) } } },
                        { $sort: { createdAt: -1 } },
                        { $limit: MESSAGES_BATCH },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'sender',
                                foreignField: '_id',
                                as: 'sender',
                                pipeline: [
                                    { $project: { name: 1, isDeleted: 1, avatar: 1 } },
                                    {
                                        $lookup: {
                                            from: 'files',
                                            localField: 'avatar',
                                            foreignField: '_id',
                                            as: 'avatar',
                                            pipeline: [{ $project: { url: 1 } }],
                                        },
                                    },
                                    { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                                ],
                            },
                        },
                        {
                            $lookup: {
                                from: 'messages',
                                localField: 'replyTo',
                                foreignField: '_id',
                                as: 'replyTo',
                                pipeline: [
                                    { $project: { text: 1, sender: 1 } },
                                    {
                                        $lookup: {
                                            from: 'users',
                                            localField: 'sender',
                                            foreignField: '_id',
                                            as: 'sender',
                                            pipeline: [{ $project: { name: 1 } }],
                                        },
                                    },
                                    { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                                ],
                            },
                        },
                        { $unwind: { path: '$replyTo', preserveNullAndEmptyArrays: true } },
                        { $unwind: { path: '$sender', preserveNullAndEmptyArrays: true } },
                        { $project: { source: 0, sourceRefPath: 0 } },
                    ],
                },
            },
            { $project: { messages: 1 } },
        ]))[0];

        if (!conversation) throw new AppException({ message: "Cannot get previous messages" }, HttpStatus.NOT_FOUND);

        conversation?.messages.length === MESSAGES_BATCH && (nextCursor = conversation?.messages[MESSAGES_BATCH - 1]._id.toString());

        return { nextCursor, messages: conversation.messages.reverse() }
    }
}