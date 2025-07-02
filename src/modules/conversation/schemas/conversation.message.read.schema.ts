import { z } from 'zod';
import { validObjId } from 'src/utils/constants';

export const messageReadSchema = z.strictObject({
    recipientId: validObjId,
    session_id: z.string().uuid('Invalid session id'),
});