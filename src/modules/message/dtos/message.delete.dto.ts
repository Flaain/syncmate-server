import { createZodDto } from 'nestjs-zod';
import { messageDeleteSchema } from '../schemas/message.delete.schema';

export class MessageDeleteDTO extends createZodDto(messageDeleteSchema) {}