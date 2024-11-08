import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AppException } from 'src/utils/exceptions/app.exception';
import { AppExceptionCode, Cookies } from 'src/utils/types';
import { AuthService } from '../auth.service';

@Injectable()
export class AccessGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    canActivate = async (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromCookies(request);
        
        const { userId, sessionId } = this.authService.verifyToken<{ userId: string, sessionId: string }>(token, 'access');
        
        const user = await this.authService.validate(userId);

        request['doc'] = { user, sessionId };

        return true;
    };

    private extractTokenFromCookies = (req: Request): string => {
        if (Cookies.ACCESS_TOKEN in req.cookies) {
            return req.cookies[Cookies.ACCESS_TOKEN];
        }

        throw new AppException({ message: 'Unauthorized', errorCode: AppExceptionCode.MISSING_ACCESS_TOKEN }, HttpStatus.UNAUTHORIZED);
    };
}
