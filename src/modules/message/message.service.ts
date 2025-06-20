import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { BaseService } from 'src/utils/services/base/base.service';
import { Message } from './schemas/message.schema';
import { MessageDocument } from './types';

@Injectable()
export class MessageService extends BaseService<MessageDocument, Message> {
    constructor(@InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>) {
        super(messageModel);
    }

    getUnreadMessagesForConversationParticipants = (source: Types.ObjectId, session?: ClientSession) => this.aggregate(
        [{ $match: { source, read_by: { $size: 0 } } }, { $group: { _id: '$sender', count: { $sum: 1 } } }],
        { session },
    );
}