import { messageSendSchema } from './conversation.message.send.schema';
import { validObjId } from 'src/utils/constants';

export const messageReplySchema = messageSendSchema.extend({ recipientId: validObjId })