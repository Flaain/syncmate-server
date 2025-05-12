import { validObjId } from 'src/utils/constants';
import { z } from 'zod';

export const conversationMessageReadSchema = z.strictObject({
    conversationId: validObjId,
    readedAt: z.coerce.date({ required_error: 'Readed date is required', invalid_type_error: 'Readed at field must be a date' }).transform((date) => date.toISOString()),
    messageId: validObjId,
    initiatorId: validObjId,
    recipientId: validObjId,
});