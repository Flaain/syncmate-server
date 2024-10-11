import { createZodDto } from 'nestjs-zod';
import { authResetSchema } from '../schemas/auth.reset.schema';

export class AuthResetDTO extends createZodDto(authResetSchema) {}