import { Controller, Post } from '@nestjs/common';
import { Routes } from 'src/utils/types';
import { OtpService } from './otp.service';
import { Public } from 'src/utils/decorators/public.decorator';
import { DTO } from 'src/utils/decorators/dto.decorator';
import { OtpCreateDTO, OtpVerifyDTO } from './types';
import { otpCreateSchema } from './schemas/otp.create.schema';
import { otpVerifySchema } from './schemas/otp.verify.schema';

@Controller(Routes.OTP)
export class OtpController {
    constructor(private readonly otpService: OtpService) {}

    @Public()
    @Post()
    create(@DTO(otpCreateSchema) { email, type }: OtpCreateDTO) {
        return this.otpService.createOtp({ email, type });
    }

    @Post('verify')
    verify(@DTO(otpVerifySchema) dto: OtpVerifyDTO) {
        return this.otpService.verify(dto);
    }
}