import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { MongoError, MongoErrorLabel } from 'mongodb';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AppException } from 'src/utils/exceptions/app.exception';
import { BaseService } from 'src/utils/services/base/base.service';
import { ConversationService } from '../conversation/conversation.service';
import { FeedService } from '../feed/feed.service';
import { FEED_TYPE } from '../feed/types';
import { BlockList } from '../user/schemas/user.blocklist.schema';
import { UserDocument } from '../user/types';
import { UserService } from '../user/user.service';
import { MessageReplyDTO } from './dtos/message.reply.dto';
import { Message } from './schemas/message.schema';
import { EditMessageParams, HandleFeedParams, MessageDocument, MessageSourceRefPath, SendMessageParams } from './types';

@Injectable()
export class MessageService extends BaseService<MessageDocument, Message> {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
        @InjectModel(BlockList.name) private readonly blocklistModel: Model<BlockList>,
        @Inject(forwardRef(() => ConversationService)) private readonly conversationService: ConversationService,
        private readonly userService: UserService,
        private readonly feedService: FeedService,
    ) {
        super(messageModel);
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

    private getUnreadMessagesForConversationParticipants = (source: Types.ObjectId, session?: ClientSession) => this.aggregate(
        [
            { $match: { source, read_by: { $size: 0 } } }, 
            { $group: { _id: '$sender', count: { $sum: 1 } } }
        ], 
        { session }
    );

    private handleFeed = async ({ conversationId, initiatorId, recipientId, lastActionAt, session, isNewConversation }: HandleFeedParams) => {
        if (isNewConversation) {
            const { _id } = (await this.feedService.create(
                [
                    {
                        item: conversationId,
                        type: FEED_TYPE.CONVERSATION,
                        configs: (await this.feedService.createConfigs([{ userId: initiatorId }, { userId: recipientId }], { session })).map((c) => c._id),
                        lastActionAt,
                    },
                ],
                { session },
            ))[0];

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

    send = async (dto: SendMessageParams) => {
        const { message, initiator, recipientId } = dto;

        await this.isMessagingRestricted({ initiator, recipientId });

        const session = await this.connection.startSession();

        try {
            session.startTransaction();

            const recipient = await this.userService.getRecipient(recipientId, session);

            const ctx = { isNewConversation: false, conversation: null };

            ctx.conversation = await this.conversationService.findOne({
                filter: { participants: { $all: [recipient._id, initiator._id] } },
                projection: { _id: 1 },
                options: { session },
            });

            if (!ctx.conversation) {
                if (recipient.isPrivate) throw new AppException({ message: 'Cannot send message' }, HttpStatus.NOT_FOUND);

                ctx.isNewConversation = true;
                ctx.conversation = (await this.conversationService.create([{ participants: [recipient._id, initiator._id] }], { session }))[0];
            }
            
            const newMessage = (
                await this.create(
                    [
                        {
                            sender: initiator._id,
                            text: message.trim(),
                            source: ctx.conversation._id,
                            sourceRefPath: MessageSourceRefPath.CONVERSATION,
                        },
                    ],
                    { session },
                )
            )[0];

            const _id = await this.handleFeed({ 
                session,  
                conversationId: ctx.conversation._id, 
                initiatorId: initiator._id,
                recipientId: recipient._id,
                lastActionAt: newMessage.createdAt,
                isNewConversation: ctx.isNewConversation
            });

            await ctx.conversation.updateOne(
                {
                    lastMessage: newMessage._id,
                    lastMessageSentAt: newMessage.createdAt,
                    $push: { messages: newMessage._id },
                },
                { session },
            );

            const unread = await this.getUnreadMessagesForConversationParticipants(ctx.conversation._id, session);

            await BaseService.commitWithRetry(session);

            return {
                isNewConversation: ctx.isNewConversation,
                unread_recipient: unread.find(({ _id }) => _id.toString() === initiator._id.toString())?.count,
                unread_initiator: unread.find(({ _id }) => _id.toString() === recipient._id.toString())?.count,
                feedItem: {
                    _id,
                    type: FEED_TYPE.CONVERSATION,
                    lastActionAt: newMessage.createdAt,
                    item: {
                        _id: ctx.conversation._id,
                        lastMessage: {
                            ...newMessage.toObject(),
                            sender: {
                                _id: initiator._id,
                                name: initiator.name,
                                email: initiator.email,
                                isOfficial: initiator.isOfficial,
                                avatar: initiator.avatar,
                            },
                        },
                        recipient,
                    },
                },
            };
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();
                return this.send(dto);
            } else {
                !session.transaction.isCommitted && (await session.abortTransaction());

                throw error;
            }
        } finally {
            session.endSession();
        }
    };

    read = async ({ messageId, initiator, recipientId }: Pick<MessageReplyDTO, 'recipientId'> & { initiator: UserDocument; messageId: string }) => {
        const message = await this.findOne({ filter: { _id: messageId, sender: { $ne: initiator._id }, read_by: { $nin: initiator._id } } });

        if (!message) throw new AppException({ message: 'Cannot read message' }, HttpStatus.NOT_FOUND);

        const conversation = await this.conversationService.findOne({
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

    reply = async (dto: MessageReplyDTO & { initiator: UserDocument; messageId: string }) => {
        const { recipientId, initiator, messageId, message } = dto;

        await this.isMessagingRestricted({ recipientId, initiator });

        const session = await this.connection.startSession();

        try {
            session.startTransaction();

            const recipient = await this.userService.getRecipient(recipientId, session);
            const replyMessage = await this.findById(messageId, { options: { populate: { path: 'sender', model: 'User', select: '_id name' }, session } });

            if (!replyMessage) throw new AppException({ message: 'Cannot reply to a message that does not exist' }, HttpStatus.NOT_FOUND);

            const conversation = await this.conversationService.findOne({
                filter: { participants: { $all: [recipient._id, initiator._id] }, messages: { $in: replyMessage._id } },
                projection: { _id: 1 },
                options: { session },
            });

            if (!conversation) throw new AppException({ message: 'Conversation not found' }, HttpStatus.NOT_FOUND);

            const newMessage = (
                await this.create(
                    [
                        {
                            sender: initiator._id,
                            text: message.trim(),
                            replyTo: replyMessage._id,
                            source: conversation._id,
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

            const unread = await this.getUnreadMessagesForConversationParticipants(conversation._id, session);

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
                                email: initiator.email,
                                isOfficial: initiator.isOfficial,
                                avatar: initiator.avatar,
                            },
                        },
                        recipient,
                    },
                },
            };
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();
                return this.reply(dto);
            } else {
                !session.transaction.isCommitted && (await session.abortTransaction());

                throw error;
            }
        } finally {
            session.endSession();
        }
    };

    edit = async ({ messageId, initiator, message: newMessage }: EditMessageParams) => {
        const message: any = await this.findOneAndUpdate({
            filter: { _id: messageId, sender: initiator._id, text: { $ne: newMessage.trim() } },
            update: { text: newMessage.trim(), hasBeenEdited: true },
            options: {
                returnDocument: 'after',
                populate: [
                    {
                        path: 'source',
                        select: '_id lastMessage participants',
                        populate: {
                            path: 'participants',
                            model: 'User',
                            select: '_id',
                            match: { _id: { $ne: initiator._id } },
                        },
                    },
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
                    email: initiator.email,
                    isOfficial: initiator.isOfficial,
                    avatar: initiator.avatar,
                },
            },
            conversationId: source._id.toString(),
            isLastMessage: message._id.toString() === source.lastMessage._id.toString(),
            recipientId: source.participants[0]._id.toString(),
        };
    };

    delete = async (dto: { messageIds: Array<string>; initiatorId: string; recipientId: string }) => {
        const { messageIds, initiatorId, recipientId } = dto;

        const session = await this.connection.startSession();

        try {
            session.startTransaction();

            const messages = await this.find({ 
                filter: { _id: { $in: messageIds }, sender: initiatorId }, 
                options: { session, projection: { _id: 1 } } 
            });

            if (!messages.length) throw new AppException({ message: 'Messages not found' }, HttpStatus.NOT_FOUND);

            const findedMessageIds = messages.map((message) => message._id.toString());

            const conversation = await this.conversationService.findOneAndUpdate({
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

            const lastMessage = isLastMessage ? conversation.messages.length ? await this.findById(conversation.messages[0]._id, params) : null : conversation.lastMessage;
            const lastMessageSentAt = (lastMessage as Message)?.createdAt ?? conversation.createdAt;

            await this.deleteMany({ _id: { $in: findedMessageIds }, sender: initiatorId }, { session });

            const unreadMessages = await this.countDocuments(
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

                return this.delete(dto);
            } else {
                !session.transaction.isCommitted && (await session.abortTransaction());

                throw error;
            }
        } finally {
            session.endSession();
        }
    };
}