import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
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

@Injectable()
export class ConversationService extends BaseService<ConversationDocument, Conversation> {
    constructor(
        @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
        @Inject(Providers.S3_CLIENT) private readonly s3: S3Client,
        @Inject(forwardRef(() => MessageService)) private readonly messageService: MessageService,
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
        const recipient = await this.userService.findOne({
            filter: { _id: recipientId },
            projection: { birthDate: 0, password: 0, isPrivate: 0 },
            options: {
                populate: [
                    {
                        path: 'avatar',
                        model: 'File',
                        select: 'url',
                    },
                ],
            },
        });

        if (!recipient) throw new AppException({ message: "User not found" }, HttpStatus.NOT_FOUND);

        let nextCursor: string | null = null;

        const conversation = await this.findOne({
            filter: { participants: { $all: [initiator._id, recipient._id] } },
            projection: { messages: 1 },
            options: {
                populate: [
                    {
                        path: 'messages',
                        model: 'Message',
                        populate: [
                            {
                                path: 'sender',
                                model: 'User',
                                select: 'name isDeleted avatar',
                                populate: { path: 'avatar', model: 'File', select: 'url' },
                            },
                            {
                                path: 'replyTo',
                                model: 'Message',
                                select: 'text sender',
                                populate: { path: 'sender', model: 'User', select: 'name' },
                            },
                        ],
                        options: {
                            limit: MESSAGES_BATCH,
                            sort: { createdAt: -1 },
                        },
                    },
                ],
            },
        });

        if (!conversation && recipient.isPrivate) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);

        conversation?.messages.length === MESSAGES_BATCH && (nextCursor = conversation?.messages[MESSAGES_BATCH - 1]._id.toString());

        return {
            conversation: {
                _id: conversation?._id, 
                recipient, 
                messages: conversation?.messages.reverse() ?? [],
            },
            nextCursor,
        };
    };

    getPreviousMessages = async ({ cursor, initiator, recipientId }: { cursor: string, initiator: UserDocument, recipientId: string }) => {
        if (!isValidObjectId(cursor) || !isValidObjectId(recipientId)) throw new AppException({ message: "Invlaid object id" }, HttpStatus.BAD_REQUEST);
        
        let nextCursor: string | null = null;

        const conversation = await this.findOne({
            filter: { participants: { $all: [initiator._id, new Types.ObjectId(recipientId)] } },
            projection: { messages: 1 },
            options: {
                populate: [
                    {
                        path: 'messages',
                        model: 'Message',
                        populate: [
                            {
                                path: 'sender',
                                model: 'User',
                                select: 'name isDeleted avatar',
                                populate: { path: 'avatar', model: 'File', select: 'url' },
                            },
                            {
                                path: 'replyTo',
                                model: 'Message',
                                select: 'text sender',
                                populate: { path: 'sender', model: 'User', select: 'name' },
                            },
                        ],
                        options: {
                            limit: MESSAGES_BATCH,
                            sort: { createdAt: -1 },
                        },
                        match: { _id: { $lt: cursor } },
                    },
                ],
            },
        });

        if (!conversation) throw new AppException({ message: "Cannot get previous messages" }, HttpStatus.NOT_FOUND);

        conversation?.messages.length === MESSAGES_BATCH && (nextCursor = conversation?.messages[MESSAGES_BATCH - 1]._id.toString());

        return { nextCursor, messages: conversation.messages.reverse() }
    }
}