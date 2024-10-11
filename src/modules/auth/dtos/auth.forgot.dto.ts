import { createZodDto } from "nestjs-zod";
import { forgotSchema } from "../schemas/auth.forgot.schema";

export class ForgotDTO extends createZodDto(forgotSchema) {}