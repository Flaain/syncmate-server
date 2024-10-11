import { createZodDto } from 'nestjs-zod';
import { signupSchema } from '../schemas/auth.signup.schema';

export class SignupDTO extends createZodDto(signupSchema) {}