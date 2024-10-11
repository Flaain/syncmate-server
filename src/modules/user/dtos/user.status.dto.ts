import { createZodDto } from 'nestjs-zod';
import { userStatusSchema } from '../schemas/user.status.schema';

export class UserStatusDTO extends createZodDto(userStatusSchema) {}