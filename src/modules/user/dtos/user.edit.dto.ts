import { createZodDto } from 'nestjs-zod';
import { userEditSchema } from '../schemas/user.edit.schema';

export class UserEditDTO extends createZodDto(userEditSchema) {}