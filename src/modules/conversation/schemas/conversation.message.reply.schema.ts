import { isValidObjectId } from 'mongoose';
import { messageSendSchema } from './conversation.message.send.schema';
import { validObjId } from 'src/utils/constants';

export const messageReplySchema = messageSendSchema
    .extend({ recipientId: validObjId })
    .refine(({ recipientId }) => isValidObjectId(recipientId), {
        message: 'Invalid recipient id',
        path: ['recipientId'],
    });