import { createZodDto } from 'nestjs-zod';
import { messageEditSchema } from '../schemas/message.edit.schema';

export class MessageEditDTO extends createZodDto(messageEditSchema) {}