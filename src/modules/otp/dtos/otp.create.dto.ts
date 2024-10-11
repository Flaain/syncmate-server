import { createZodDto } from 'nestjs-zod';
import { OtpCreateSchema } from '../schemas/otp.create.schema';

export class OtpCreateDTO extends createZodDto(OtpCreateSchema) {}