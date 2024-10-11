import { createZodDto } from 'nestjs-zod';
import { messageSendSchema } from '../schemas/message.send.schema';

export class MessageSendDTO extends createZodDto(messageSendSchema) {}