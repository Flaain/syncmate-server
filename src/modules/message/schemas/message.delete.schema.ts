import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

export const messageDeleteSchema = z
    .strictObject({
        recipientId: z.string().trim().min(1, 'Recipient id is required').max(24, 'Recipient id is invalid'),
        messageIds: z
            .array(z.string().trim().min(1, 'Message id is required').max(24, 'Message id is invalid'))
            .min(1, 'At least one message id is required'),
    })
    .superRefine(({ messageIds, recipientId }, ctx) => {
        messageIds.forEach((messageId) => {
            !isValidObjectId(messageId) && ctx.addIssue({
                code: 'custom',
                message: `Message id (${messageId}) is invalid`,
            });
        });

        !isValidObjectId(recipientId) && ctx.addIssue({
            code: 'custom',
            message: `Recipient id (${recipientId}) is invalid`,
        });
    });