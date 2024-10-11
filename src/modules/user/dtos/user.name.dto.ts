import { createZodDto } from 'nestjs-zod';
import { userNameSchema } from '../schemas/user.name.schema';

export class UserNameDto extends createZodDto(userNameSchema) {}