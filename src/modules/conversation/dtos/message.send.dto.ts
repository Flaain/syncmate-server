import { createZodDto } from 'nestjs-zod';
import { messageSendSchema } from '../schemas/conversation.message.send.schema';

export class MessageSendDTO extends createZodDto(messageSendSchema) {}