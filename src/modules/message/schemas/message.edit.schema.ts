import { z } from 'zod';
import { messageForSchema } from 'src/utils/constants';
import { isValidObjectId } from 'mongoose';

export const messageEditSchema = z
    .object({
        message: messageForSchema,
        recipientId: z.string().min(1, 'recipientId is required').max(24, 'recipientId is invalid'),
    })
    .refine(({ recipientId }) => isValidObjectId(recipientId), { message: `Invalid object id` });