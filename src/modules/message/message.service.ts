import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message } from './schemas/message.schema';
import { Model, Types } from 'mongoose';
import { EditMessageParams, MessageDocument, MessageSenderRefPath, MessageSourceRefPath, SendMessageParams } from './types';
import { ConversationService } from '../conversation/conversation.service';
import { AppException } from 'src/utils/exceptions/app.exception';
import { BaseService } from 'src/utils/services/base/base.service';
import { UserService } from '../user/user.service';
import { UserDocument } from '../user/types';
import { MessageReplyDTO } from './dtos/message.reply.dto';
import { FeedService } from '../feed/feed.service';
import { FEED_TYPE } from '../feed/types';
import { BlockList } from '../user/schemas/user.blocklist.schema';
import { recipientProjection } from '../conversation/constants';
import { defaultSuccessResponse } from 'src/utils/constants';

@Injectable()
export class MessageService extends BaseService<MessageDocument, Message> {
    constructor(
        @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
        @InjectModel(BlockList.name) private readonly blocklistModel: Model<BlockList>,
        @Inject(forwardRef(() => ConversationService)) private readonly conversationService: ConversationService,
        private readonly userService: UserService,
        private readonly feedService: FeedService
    ) {
        super(messageModel);
    }

    private isMessagingRestricted = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        if (
            await this.blocklistModel.exists({
                $or: [
                    { user: recipientId, blockList: { $in: [initiator._id] } },
                    { user: initiator._id, blockList: { $in: [recipientId] } },
                ],
            })
        )
            throw new AppException({ message: 'Messaging restricted' }, HttpStatus.BAD_REQUEST);
    }

    send = async ({ recipientId, message, initiator }: SendMessageParams) => {
        await this.isMessagingRestricted({ initiator, recipientId });
        
        const recipient = await this.userService.getRecipient(recipientId);

        const ctx = { isNewConversation: false, conversation: null };

        ctx.conversation = await this.conversationService.findOne({
            filter: { participants: { $all: [recipient._id, initiator._id] } },
            projection: { _id: 1 },
        });
        
        if (!ctx.conversation) {
            if (recipient.isPrivate) throw new AppException({ message: 'Cannot send message' }, HttpStatus.NOT_FOUND);

            ctx.isNewConversation = true;
            ctx.conversation = await this.conversationService.create({ participants: [recipient._id, initiator._id] });
        };

        const newMessage = await this.create({ 
            sender: initiator._id, 
            senderRefPath: MessageSenderRefPath.USER,
            text: message.trim(),
            source: ctx.conversation._id,
            sourceRefPath: MessageSourceRefPath.CONVERSATION,
        });

        const { _id, type, lastActionAt } = await (ctx.isNewConversation
        ? this.feedService.create({
              item: ctx.conversation._id,
              type: FEED_TYPE.CONVERSATION,
              users: [initiator._id, recipient._id],
              lastActionAt: newMessage.createdAt,
          })
        : this.feedService.findOneAndUpdate({
              filter: { item: ctx.conversation._id, users: { $in: [initiator._id, recipient._id] }, type: FEED_TYPE.CONVERSATION },
              update: { lastActionAt: newMessage.createdAt },
              options: { returnDocument: 'after' }
          }));

        await ctx.conversation.updateOne({
            lastMessage: newMessage._id,
            lastMessageSentAt: newMessage.createdAt,
            $push: { messages: newMessage._id },
        });

        const { 0: unreadFromInitiator, 1: unreadFromRecipient } = await Promise.all([
            this.countDocuments({ hasBeenRead: false, source: ctx.conversation._id, sender: initiator._id }),
            this.countDocuments({ hasBeenRead: false, source: ctx.conversation._id, sender: recipient._id }),
        ]);
        
        return {
            isNewConversation: ctx.isNewConversation,
            unreadMessages: { initiator: unreadFromRecipient, recipient: unreadFromInitiator },
            feedItem: {
                _id,
                type,
                lastActionAt,
                item: {
                    _id: ctx.conversation._id,
                    lastMessage: {
                        ...newMessage.toObject<Message>(),
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
    };

    read = async ({ messageId, initiator, recipientId }: Pick<MessageReplyDTO, 'recipientId'> & { initiator: UserDocument, messageId: string }) => {
        const message = await this.findOne({ filter: { _id: messageId, sender: recipientId, hasBeenRead: false } });

        if (!message) throw new AppException({ message: 'Cannot read message' }, HttpStatus.NOT_FOUND);

        const conversation = await this.conversationService.findOne({
            filter: {
                participants: { $all: [initiator._id, recipientId] },
                messages: { $in: message._id },
            },
        });

        if (!conversation) throw new AppException({ message: 'Cannot read message' }, HttpStatus.NOT_FOUND);
        
        const readedAt = new Date();
        
        await message.updateOne({ hasBeenRead: true, readedAt });

        return { conversationId: conversation._id.toString(), readedAt: readedAt.toISOString() };
    }

    reply = async ({ messageId, recipientId, message, initiator }: MessageReplyDTO & { initiator: UserDocument, messageId: string }) => {
        await this.isMessagingRestricted({ recipientId, initiator });
        
        const recipient = await this.userService.findOne({ filter: { _id: recipientId, isDeleted: false }, projection: recipientProjection });

        if (!recipient) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);
        
        const replyMessage = await this.findById(messageId, { options: { populate: { path: 'sender', model: 'User', select: '_id name' } } });

        if (!replyMessage) throw new AppException({ message: 'Cannot reply to a message that does not exist' }, HttpStatus.NOT_FOUND);

        const conversation = await this.conversationService.findOne({
            filter: { participants: { $all: [recipient._id, initiator._id] }, messages: { $in: replyMessage._id } },
            projection: { _id: 1 },
        });

        if (!conversation) throw new AppException({ message: 'Conversation not found' }, HttpStatus.NOT_FOUND);

        const newMessage = await this.create({ 
            sender: initiator._id, 
            senderRefPath: MessageSenderRefPath.USER,
            text: message.trim(), 
            replyTo: replyMessage._id,
            source: conversation._id,
            sourceRefPath: MessageSourceRefPath.CONVERSATION,
            inReply: true
        });

        const { _id, type, lastActionAt } = await this.feedService.findOneAndUpdate({ 
            filter: { item: conversation._id, type: FEED_TYPE.CONVERSATION }, 
            update: { lastActionAt: newMessage.createdAt },
            options: { returnDocument: 'after' } 
        });

        const { 0: unreadFromInitiator, 1: unreadFromRecipient } = await Promise.all([
            this.countDocuments({ hasBeenRead: false, source: conversation._id, sender: initiator._id }),
            this.countDocuments({ hasBeenRead: false, source: conversation._id, sender: recipient._id }),
            replyMessage.updateOne({ $push: { replies: newMessage._id } }),
            conversation.updateOne({ lastMessage: newMessage._id, lastMessageSentAt: newMessage.createdAt, $push: { messages: newMessage._id } })
        ]);

        return {
            unreadMessages: { initiator: unreadFromRecipient, recipient: unreadFromInitiator },
            feedItem: {
                _id,
                type,
                lastActionAt,
                item: {
                    _id: conversation._id,
                    lastMessage: {
                        ...newMessage.toObject<Message>(),
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
    }

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

        if (!message) throw new AppException({ message: "Cannot edit message" }, HttpStatus.FORBIDDEN);
        
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
                }
            },
            conversationId: source._id.toString(),  
            isLastMessage: message._id.toString() === source.lastMessage._id.toString(),
            recipientId: source.participants[0]._id.toString()
        };
    };

    delete = async ({ messageIds, initiatorId, recipientId }: { messageIds: Array<string>, initiatorId: string, recipientId: string }) => {
        const messages = await this.find({ filter: { _id: { $in: messageIds }, sender: initiatorId } });

        if (!messages.length) throw new AppException({ message: "Messages not found" }, HttpStatus.NOT_FOUND);

        const findedMessageIds = messages.map(message => message._id.toString());
        
        const conversation = await this.conversationService.findOneAndUpdate({
            filter: {
                participants: { $all: [initiatorId, recipientId] },
                messages: { $all: findedMessageIds },
            },
            update: { $pull: { messages: { $in: findedMessageIds } } },
            options: {
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
                    select: 'sender text',
                }
            }
        });
        
        if (!conversation) throw new AppException({ message: "Conversation not found" }, HttpStatus.NOT_FOUND);

        const isLastMessage = findedMessageIds.includes(conversation.lastMessage._id.toString());
        const lastMessage = isLastMessage ? conversation.messages.length ? await this.findById(conversation.messages[0]._id, {
            options: {
                populate: {
                    path: 'sender',
                    model: 'User',
                    select: 'name',
                },
            },
        }) : null : conversation.lastMessage;
        const lastMessageSentAt = 'createdAt' in lastMessage ? lastMessage.createdAt : conversation.createdAt;

        await this.deleteMany({ _id: { $in: findedMessageIds }, sender: initiatorId });
        // because Promise.all run in parallel first of all need to make sure that all messages are deleted to count the unread messages

        const { 0: unreadMessages } = await Promise.all([
            this.countDocuments({ hasBeenRead: false, source: conversation._id, sender: initiatorId }),
            isLastMessage && conversation.updateOne({ lastMessage, lastMessageSentAt }),
            this.feedService.updateOne({ filter: { item: conversation._id, type: FEED_TYPE.CONVERSATION }, update: { lastActionAt: lastMessageSentAt } }),
        ]);

        return {
            unreadMessages,
            findedMessageIds,
            isLastMessage,
            lastMessage,
            lastMessageSentAt,
            conversationId: conversation._id.toString()
        }
    }
}