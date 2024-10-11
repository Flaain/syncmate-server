import { createZodDto } from 'nestjs-zod';
import { signinSchema } from '../schemas/auth.signin.schema';

export class SigninDTO extends createZodDto(signinSchema) {}