import { createZodDto } from "nestjs-zod";
import { otpVerifySchema } from "../schemas/otp.verify.schema";

export class OtpVerifyDTO extends createZodDto(otpVerifySchema) {}