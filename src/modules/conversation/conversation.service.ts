import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { MongoError, MongoErrorLabel } from 'mongodb';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AppException } from 'src/utils/exceptions/app.exception';
import { BaseService } from 'src/utils/services/base/base.service';
import { FeedService } from '../feed/feed.service';
import { MessageService } from '../message/message.service';
import { BlockList } from '../user/schemas/user.blocklist.schema';
import { UserDocument } from '../user/types';
import { UserService } from '../user/user.service';
import { Conversation } from './schemas/conversation.schema';
import { ConversationDocument, ConversationSettingsDocument, EditMessageParams, HandleFeedParams, MessageReplyDTO, SendMessageParams } from './types';
import { ConversationSettings } from './schemas/conversation.settings.schema';
import { FEED_TYPE } from '../feed/types';
import { MessageSourceRefPath } from '../message/types';
import { Message } from '../message/schemas/message.schema';
import { getBlockedPipeline } from './utils/getBlockedPipeline';
import { getConversationPipeline } from './utils/getConversationPipeline';

@Injectable()
export class ConversationService extends BaseService<ConversationDocument, Conversation> {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
        @InjectModel(ConversationSettings.name) private readonly conversationSettingsModel: Model<ConversationSettingsDocument>,
        @InjectModel(BlockList.name) private readonly blocklistModel: Model<BlockList>,
        private readonly messageService: MessageService,
        private readonly feedService: FeedService,
        private readonly userService: UserService
    ) {
        super(conversationModel);
    }

    deleteConversation = async (dto: { initiatorId: Types.ObjectId; recipientId: string }) => {
        const { initiatorId, recipientId } = dto, session = await this.connection.startSession();
        
        session.startTransaction();

        try {
            const recipient = await this.userService.findOne({ 
                filter: { _id: recipientId }, projection: { birthDate: 0, password: 0 },
                options: { session } 
            });

            if (!recipient) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);

            const conversation = await this.findOne({ 
                filter: { participants: { $all: [initiatorId, recipient._id] } },
                options: { session } 
            });

            if (!conversation) throw new AppException({ message: 'Conversation not found' }, HttpStatus.NOT_FOUND);
            
            await conversation.deleteOne({ session });
            await this.messageService.deleteMany({ source: conversation._id }, { session });

            const feed = await this.feedService.findOneAndDelete(
                { item: conversation._id },
                { session, projection: { configs: 1 }, returnDocument: 'after' },
            );

            if (!feed) throw new AppException({ message: 'Feed not found' }, HttpStatus.NOT_FOUND);
            
            await this.feedService.deleteConfigs({ _id: { $in: feed.configs } }, { session });

            await BaseService.commitWithRetry(session);

            return { _id: conversation._id, recipientId: recipient._id.toString() };
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();
                
                return this.deleteConversation(dto);
            } else {
                !session.transaction.isCommitted && await session.abortTransaction();

                throw error;
            }
        } finally {
            session.endSession();
        }
    };
    
    getConversation = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        const recipient = await this.userService.getRecipient(recipientId, initiator._id);

        const { 0: { isInitiatorBlocked, isRecipientBlocked } } = await this.blocklistModel.aggregate(getBlockedPipeline(initiator._id, recipient._id));
        
        const conversation = (await this.aggregate(getConversationPipeline(initiator._id, recipient._id)))[0];

        return { 
            ...(conversation ?? { messages: { cursor: null, data: [] } }), 
            recipient,
            isInitiatorBlocked, 
            isRecipientBlocked 
        };
    };

    getPreviousMessages = async ({ cursor, initiator, recipientId }: { cursor: string, initiator: UserDocument, recipientId: string }) => {        
        const conversation = (await this.aggregate(getConversationPipeline(initiator._id, new Types.ObjectId(recipientId), cursor)))[0];

        if (!conversation) throw new AppException({ message: "Cannot get previous messages" }, HttpStatus.NOT_FOUND);

        return conversation.messages;
    }

    private isMessagingRestricted = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        if (
            await this.blocklistModel.exists({
                $or: [
                    { user: new Types.ObjectId(recipientId), blockList: { $in: initiator._id } },
                    { user: initiator._id, blockList: { $in: recipientId } },
                ],
            })
        )
            throw new AppException({ message: 'Messaging is restricted' }, HttpStatus.FORBIDDEN);
    };

    private handleFeed = async ({ conversationId, initiatorId, recipientId, lastActionAt, session, isNewConversation }: HandleFeedParams) => {
        if (isNewConversation) {
            const { _id } = (
                await this.feedService.create(
                    [
                        {
                            item: conversationId,
                            type: FEED_TYPE.CONVERSATION,
                            configs: (
                                await this.feedService.createConfigs(
                                    [{ userId: initiatorId }, { userId: recipientId }],
                                    { session },
                                )
                            ).map((c) => c._id),
                            lastActionAt,
                        },
                    ],
                    { session },
                )
            )[0];

            return _id;
        } else {
            const { _id } = await this.feedService.findOneAndUpdate({
                filter: { item: conversationId },
                update: { lastActionAt },
                options: { returnDocument: 'after', session, projection: { _id: 1 } },
            });

            return _id;
        }
    }

    getUnreadMessagesForConversationParticipants = async (conversationId: Types.ObjectId, session?: ClientSession) => {
        return this.aggregate(
            [
                { $match: { _id: conversationId } },
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'messages',
                        foreignField: '_id',
                        as: 'messages',
                        pipeline: [
                            { $match: { read_by: { $size: 0 } } },
                            { $group: { _id: '$sender', count: { $sum: 1 } } },
                        ],
                    },
                },
                { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
                { $project: { messages: 1 } },
            ],
            { session },
        );
    }

    onMessageSend = async (dto: SendMessageParams) => {
        const { message, initiator, recipientId } = dto;

        await this.isMessagingRestricted({ initiator, recipientId });

        const session = await this.connection.startSession();

        try {
            session.startTransaction();

            const { isMessagingRestricted, ...recipient } = await this.userService.getRecipient(recipientId, initiator._id, session, true);

            const newMessage = (
                await this.messageService.create(
                    [
                        {
                            sender: initiator._id,
                            text: message.trim(),
                            sourceRefPath: MessageSourceRefPath.CONVERSATION,
                        },
                    ],
                    { session },
                )
            )[0];
            
            const { value, lastErrorObject }: any = await this.findOneAndUpdate({
                filter: {
                    participants: {
                        $all: [{ $elemMatch: { $eq: recipient._id } }, { $elemMatch: { $eq: initiator._id } }],
                    },
                },
                // THINK: right now its only a way to use upsert with this query. Cannot use just $all: [recipient._id, initiator._id]
                update: {
                    $setOnInsert: { participants: [recipient._id, initiator._id] },
                    $push: { messages: newMessage._id },
                    lastMessage: newMessage._id,
                    lastMessageSentAt: newMessage.createdAt,
                },
                options: { session, new: true, upsert: true, includeResultMetadata: true, projection: { _id: 1 } },
            });

            const isNewConversation = !lastErrorObject.updatedExisting;

            if (isMessagingRestricted && isNewConversation) {
                throw new AppException(
                    { message: 'Cannot send message. Recipient does not accept messages from new contacts' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            const _id = await this.handleFeed({ 
                session,  
                isNewConversation,
                conversationId: value._id, 
                initiatorId: initiator._id,
                recipientId: recipient._id,
                lastActionAt: newMessage.createdAt,
            });

            const unread = await this.getUnreadMessagesForConversationParticipants(value._id, session);
            const initiatorAsRecipient = await this.userService.getInitiatorAsRecipient(initiator, recipient._id, session);

            await BaseService.commitWithRetry(session);

            return {
                isNewConversation,
                initiatorAsRecipient,
                unread_recipient: unread.find(({ messages }) => messages?._id.toString() === initiator._id.toString())?.messages.count,
                unread_initiator: unread.find(({ messages }) => messages?._id.toString() === recipient._id.toString())?.messages.count,
                feedItem: {
                    _id,
                    type: FEED_TYPE.CONVERSATION,
                    lastActionAt: newMessage.createdAt,
                    item: {
                        _id: value._id,
                        lastMessage: {
                            ...newMessage.toObject(),
                            sender: {
                                _id: initiator._id,
                                name: initiator.name,
                                isOfficial: initiator.isOfficial,
                            },
                        },
                        recipient,
                    },
                },
            };
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();
                
                return this.onMessageSend(dto);
            } else {
                !session.transaction.isCommitted && (await session.abortTransaction());

                throw error;
            }
        } finally {
            session.endSession();
        }
    };

    onMessageReply = async (dto: MessageReplyDTO & { initiator: UserDocument; messageId: string }) => {
        const { recipientId, initiator, messageId, message } = dto;

        await this.isMessagingRestricted({ recipientId, initiator });

        const session = await this.connection.startSession();

        try {
            session.startTransaction();

            const recipient = await this.userService.getRecipient(recipientId, initiator._id, session, true);
            const replyMessage = await this.messageService.findById(messageId, {
                options: { populate: { path: 'sender', model: 'User', select: '_id name' }, session },
            });

            if (!replyMessage) throw new AppException({ message: 'Cannot reply to a message that does not exist' }, HttpStatus.BAD_REQUEST);

            const conversation = await this.findOne({
                filter: { participants: { $all: [recipient._id, initiator._id] }, messages: { $in: replyMessage._id } },
                projection: { _id: 1 },
                options: { session },
            });

            if (!conversation) throw new AppException({ message: 'Conversation not found' }, HttpStatus.NOT_FOUND);

            const newMessage = (
                await this.messageService.create(
                    [
                        {
                            sender: initiator._id,
                            text: message.trim(),
                            replyTo: replyMessage._id,
                            sourceRefPath: MessageSourceRefPath.CONVERSATION,
                            inReply: true,
                        },
                    ],
                    { session },
                )
            )[0];

            const { _id } = await this.feedService.findOneAndUpdate({
                filter: { item: conversation._id },
                update: { lastActionAt: newMessage.createdAt },
                options: { returnDocument: 'after', session, projection: { _id: 1 } },
            });

            const unread = await this.messageService.getUnreadMessagesForConversationParticipants(conversation._id, session);
            const initiatorAsRecipient = await this.userService.getInitiatorAsRecipient(initiator, recipient._id, session);

            await replyMessage.updateOne({ $push: { replies: newMessage._id } }, { session });

            await conversation.updateOne(
                {
                    lastMessage: newMessage._id,
                    lastMessageSentAt: newMessage.createdAt,
                    $push: { messages: newMessage._id },
                },
                { session },
            );

            await BaseService.commitWithRetry(session);

            return {
                initiatorAsRecipient,
                unread_recipient: unread.find(({ _id }) => _id.toString() === initiator._id.toString())?.count,
                unread_initiator: unread.find(({ _id }) => _id.toString() === recipient._id.toString())?.count,
                feedItem: {
                    _id,
                    type: FEED_TYPE.CONVERSATION,
                    lastActionAt: newMessage.createdAt,
                    item: {
                        _id: conversation._id,
                        lastMessage: {
                            ...newMessage.toObject(),
                            replyTo: {
                                _id: replyMessage._id,
                                text: replyMessage.text,
                                sender: replyMessage.sender,
                            },
                            sender: {
                                _id: initiator._id,
                                name: initiator.name,
                                isOfficial: initiator.isOfficial,
                            },
                        },
                        recipient,
                    },
                },
            };
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();
                return this.onMessageReply(dto);
            } else {
                !session.transaction.isCommitted && (await session.abortTransaction());

                throw error;
            }
        } finally {
            session.endSession();
        }
    };

    onMessageEdit = async ({ messageId, initiator, recipientId, message: newMessage }: EditMessageParams) => {
        /* TODO: fix type */
        const message: any = await this.messageService.findOneAndUpdate({
            filter: { _id: messageId, sender: initiator._id, text: { $ne: newMessage.trim() } },
            update: { text: newMessage.trim(), hasBeenEdited: true },
            options: {
                returnDocument: 'after',
                populate: [
                    {
                        path: 'replyTo',
                        model: 'Message',
                        select: 'text sender',
                        populate: { path: 'sender', model: 'User', select: 'name' },
                    },
                ],
            },
        });

        if (!message) throw new AppException({ message: 'Cannot edit message' }, HttpStatus.FORBIDDEN);

        const { source, ...restMessage } = message.toObject();

        return {
            message: {
                ...restMessage,
                sender: {
                    _id: initiator._id,
                    name: initiator.name,
                    isOfficial: initiator.isOfficial,
                },
            },
            conversationId: source._id.toString(),
            isLastMessage: message._id.toString() === source.lastMessage._id.toString(),
            recipientId: source.participants[0]._id.toString(),
        };
    };

    onMessageDelete = async (dto: { messageIds: Array<string>; initiatorId: string; recipientId: string }) => {
        const { messageIds, initiatorId, recipientId } = dto;

        const session = await this.connection.startSession();

        try {
            session.startTransaction();

            const messages = await this.messageService.find({ 
                filter: { _id: { $in: messageIds }, sender: initiatorId }, 
                options: { session, projection: { _id: 1 } } 
            });

            if (!messages.length) throw new AppException({ message: 'Messages not found' }, HttpStatus.NOT_FOUND);

            const findedMessageIds = messages.map((message) => message._id.toString());

            const conversation = await this.findOneAndUpdate({
                filter: {
                    participants: { $all: [initiatorId, recipientId] },
                    messages: { $all: findedMessageIds },
                },
                update: { $pull: { messages: { $in: findedMessageIds } } },
                options: {
                    session,
                    returnDocument: 'after',
                    projection: {
                        _id: 1,
                        lastMessage: 1,
                        createdAt: 1,
                        messages: { $slice: -1 },
                    },
                    populate: {
                        path: 'lastMessage',
                        model: 'Message',
                        select: 'text',
                        populate: {
                            path: 'sender',
                            model: 'User',
                            select: 'name',
                        }
                    },
                },
            });

            if (!conversation) throw new AppException({ message: 'Conversation not found' }, HttpStatus.NOT_FOUND);

            const isLastMessage = findedMessageIds.includes(conversation.lastMessage._id.toString());
            const params = { options: { session, populate: { path: 'sender', model: 'User', select: 'name' } } };

            const lastMessage = isLastMessage ? conversation.messages.length ? await this.messageService.findById(conversation.messages[0]._id, params) : null : conversation.lastMessage;
            const lastMessageSentAt = (lastMessage as Message)?.createdAt ?? conversation.createdAt;

            await this.deleteMany({ _id: { $in: findedMessageIds }, sender: initiatorId }, { session });

            const unreadMessages = await this.messageService.countDocuments(
                {
                    source: conversation._id,
                    sender: initiatorId,
                    read_by: { $nin: recipientId },
                },
                { session },
            );

            isLastMessage && (await conversation.updateOne({ lastMessage, lastMessageSentAt }, { session }));

            isLastMessage && await this.feedService.findOneAndUpdate({
                filter: { item: conversation._id },
                update: { lastActionAt: lastMessageSentAt },
                options: { session },
            });

            await BaseService.commitWithRetry(session);

            return {
                unreadMessages,
                findedMessageIds,
                isLastMessage,
                lastMessage,
                lastMessageSentAt,
                conversationId: conversation._id.toString(),
            };
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();

                return this.onMessageDelete(dto);
            } else {
                !session.transaction.isCommitted && (await session.abortTransaction());

                throw error;
            }
        } finally {
            session.endSession();
        }
    };

    onMessageRead = async ({ messageId, initiator, recipientId }: Pick<MessageReplyDTO, 'recipientId'> & { initiator: UserDocument; messageId: string }) => {
        const message = await this.messageService.findOne({
            filter: { _id: messageId, sender: { $ne: initiator._id }, read_by: { $nin: initiator._id } },
        });

        if (!message) throw new AppException({ message: 'Cannot read message' }, HttpStatus.NOT_FOUND);

        const conversation = await this.findOne({
            filter: {
                participants: { $all: [initiator._id, recipientId] },
                messages: { $in: message._id },
            },
        });

        if (!conversation) throw new AppException({ message: 'Cannot read message' }, HttpStatus.NOT_FOUND);

        const readedAt = new Date();

        await message.updateOne({ readedAt, $push: { read_by: initiator._id } });

        return { conversationId: conversation._id.toString(), readedAt: readedAt.toISOString() };
    };
}