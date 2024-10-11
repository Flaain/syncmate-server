import { z } from 'zod';
import { isValidObjectId } from 'mongoose';

export const conversationCreateSchema = z
    .strictObject({
        recipientId: z.string().min(1, 'Recipient id is required').max(24, 'Recipient id is invalid'),
    })
    .refine(({ recipientId }) => isValidObjectId(recipientId), {
        message: `Invalid recipient id`,
    });