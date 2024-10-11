import { z } from 'zod';
import { messageSendSchema } from './message.send.schema';
import { isValidObjectId } from 'mongoose';

export const messageReplySchema = messageSendSchema
    .extend({
        recipientId: z.string().trim().min(1, 'Recipient id is required').max(24, 'Recipient id is invalid'),
    })
    .refine(({ recipientId }) => isValidObjectId(recipientId), {
        message: 'Invalid recipient id',
        path: ['recipientId'],
    });