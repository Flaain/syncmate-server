import { z } from 'zod';
import { validObjId } from 'src/utils/constants';

export const conversationRecipientSchema = z.strictObject({ recipientId: validObjId })