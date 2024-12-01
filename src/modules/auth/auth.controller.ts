import { z } from 'zod';
import { Request, Response } from 'express';
import { SigninDTO } from './dtos/auth.signin.dto';
import { SignupDTO } from './dtos/auth.signup.dto';
import { AuthService } from './auth.service';
import { RequestWithSession, RequestWithUser, Routes } from 'src/utils/types';
import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { CookiesService } from 'src/utils/services/cookies/cookies.service';
import { AuthChangePasswordType } from './types';
import { ForgotDTO } from './dtos/auth.forgot.dto';
import { AuthResetDTO } from './dtos/auth.reset.dto';
import { authChangePasswordSchema } from './schemas/auth.change.password.schema';
import { RefreshGuard } from './guards/auth.refresh.guard';
import { AccessGuard } from './guards/auth.access.guard';
import { OtpService } from '../otp/otp.service';
import { OtpType } from '../otp/types';
import { defaultSuccessResponse } from 'src/utils/constants';

@Controller(Routes.AUTH)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly cookiesService: CookiesService,
        private readonly otpService: OtpService,
    ) {}

    @Post('signup')
    async signup(@Body() dto: Required<SignupDTO>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const { user, accessToken, refreshToken } = await this.authService.signup({ 
            ...dto, 
            userAgent: req.headers['user-agent'],
            userIP: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress 
        });

        this.cookiesService.setAuthCookies({ res, accessToken, refreshToken });

        return user;
    }

    @Post('signin')
    async signin(@Body() dto: SigninDTO, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const { user, accessToken, refreshToken } = await this.authService.signin({
            ...dto,
            userAgent: req.headers['user-agent'],
            userIP: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress
        });

        this.cookiesService.setAuthCookies({ res, accessToken, refreshToken });

        return user;
    }

    @Get('refresh')
    @UseGuards(RefreshGuard)
    async refresh(@Req() req: RequestWithSession, @Res({ passthrough: true }) res: Response) {
       const { accessToken } = await this.authService.refresh(req.doc.session);

       this.cookiesService.setAccessToken(res, accessToken);

       return defaultSuccessResponse;
    }

    @Post('password')
    @UseGuards(AccessGuard)
    password(@Req() req: RequestWithUser, @Body() dto: Omit<z.infer<typeof authChangePasswordSchema>, 'type'>, @Query('type') type: AuthChangePasswordType) {
        return this.authService.changePassword({ initiator: req.doc.user, type, ...dto });
    }

    @Post('password/forgot')
    forgot(@Body() dto: ForgotDTO) {
        return this.otpService.createOtp({ email: dto.email, type: OtpType.PASSWORD_RESET });
    }

    @Post('reset')
    reset(@Body() dto: AuthResetDTO) {
        return this.authService.reset(dto);
    }


    @Get('logout')
    @UseGuards(AccessGuard)
    async logout(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
        this.cookiesService.removeAuthCookies(res);

        const status = await this.authService.logout({ user: req.doc.user, sessionId: req.doc.sessionId });

        return status;
    }

    @Get('me')
    @UseGuards(AccessGuard)
    profile(@Req() req: RequestWithUser) {
        return this.authService.profile(req.doc.user);
    }
}