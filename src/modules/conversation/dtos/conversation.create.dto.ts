import { createZodDto } from 'nestjs-zod';
import { conversationCreateSchema } from '../schemas/conversation.create.schema';

export class ConversationCreateDTO extends createZodDto(conversationCreateSchema) {}
