import { Body, Controller, Post } from '@nestjs/common';
import { Routes } from 'src/utils/types';
import { OtpCreateDTO } from './dtos/otp.create.dto';
import { OtpService } from './otp.service';
import { OtpVerifyDTO } from './dtos/otp.verify.dto';
import { Public } from 'src/utils/decorators/public.decorator';

@Controller(Routes.OTP)
export class OtpController {
    constructor(private readonly otpService: OtpService) {}

    @Public()
    @Post()
    create(@Body() { email, type }: OtpCreateDTO) {
        return this.otpService.createOtp({ email, type });
    }

    @Post('verify')
    verify(@Body() dto: OtpVerifyDTO) {
        return this.otpService.verify(dto);
    }
}