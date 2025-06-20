import { createZodDto } from 'nestjs-zod';
import { messageReplySchema } from '../schemas/conversation.message.reply.schema';

export class MessageReplyDTO extends createZodDto(messageReplySchema) {}