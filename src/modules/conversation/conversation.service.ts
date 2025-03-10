import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { ConversationDocument } from './types';
import { AppException } from 'src/utils/exceptions/app.exception';
import { UserService } from '../user/user.service';
import { UserDocument } from '../user/types';
import { BaseService } from 'src/utils/services/base/base.service';
import { Providers } from 'src/utils/types';
import { S3Client } from '@aws-sdk/client-s3';
import { FeedService } from '../feed/feed.service';
import { MessageService } from '../message/message.service';
import { BlockList } from '../user/schemas/user.blocklist.schema';
import { getConversationPipeline, isBlockedPipeline } from './utils/pipelines';

@Injectable()
export class ConversationService extends BaseService<ConversationDocument, Conversation> {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
        @Inject(Providers.S3_CLIENT) private readonly s3: S3Client,
        @Inject(forwardRef(() => MessageService)) private readonly messageService: MessageService,
        @InjectModel(BlockList.name) private readonly blocklistModel: Model<BlockList>,
        private readonly feedService: FeedService,
        private readonly userService: UserService
    ) {
        super(conversationModel);
    }

    deleteConversation = async ({ initiatorId, recipientId }: { initiatorId: Types.ObjectId; recipientId: string }) => {
        const session = await this.connection.startSession();
        
        session.startTransaction();

        try {
            const recipient = await this.userService.findOne({ 
                filter: { _id: recipientId }, projection: { birthDate: 0, password: 0, isPrivate: 0 },
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
            await this.feedService.findOneAndDelete({ users: { $all: [initiatorId, recipientId] }, item: conversation._id }, { session });
            // as mongoose docs says - "Running operations in parallel is not supported during a transaction" so i can't use Promise.all
            // https://mongoosejs.com/docs/transactions.html#note-about-parallelism-in-transactions 

            await session.commitTransaction();

            return { _id: conversation._id, recipientId: recipient._id.toString() };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            await session.endSession();
        }
    };
    
    getConversation = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        const recipient = await this.userService.getRecipient(recipientId);

        const { 0: { isInitiatorBlocked, isRecipientBlocked } } = await this.blocklistModel.aggregate(isBlockedPipeline(initiator._id, recipient._id));
        
        const conversation = (await this.aggregate(getConversationPipeline(initiator._id, recipient._id)))[0];

        return { ...(conversation ?? { messages: { cursor: null, data: [] } }), recipient, isInitiatorBlocked, isRecipientBlocked };
    };

    getPreviousMessages = async ({ cursor, initiator, recipientId }: { cursor: string, initiator: UserDocument, recipientId: string }) => {        
        const conversation = (await this.aggregate(getConversationPipeline(initiator._id, new Types.ObjectId(recipientId), cursor)))[0];

        if (!conversation) throw new AppException({ message: "Cannot get previous messages" }, HttpStatus.NOT_FOUND);

        return conversation.messages;
    }
}