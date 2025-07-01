import { validObjId } from 'src/utils/constants';
import { messageSendSchema } from './conversation.message.send.schema';

export const messageEditSchema = messageSendSchema.extend({ recipientId: validObjId });