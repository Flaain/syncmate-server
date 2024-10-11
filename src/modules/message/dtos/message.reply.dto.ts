import { createZodDto } from 'nestjs-zod';
import { messageReplySchema } from '../schemas/message.reply.schema';

export class MessageReplyDTO extends createZodDto(messageReplySchema) {}