import { z } from 'zod';
import { messageForSchema } from 'src/utils/constants';

export const messageSendSchema = z.object({ message: messageForSchema, session_id: z.string().uuid('Invalid session id') });