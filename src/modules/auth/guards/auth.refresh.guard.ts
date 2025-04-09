import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from 'src/modules/session/session.service';
import { AppException } from 'src/utils/exceptions/app.exception';
import { AppExceptionCode, Cookies } from 'src/utils/types';
import { AuthService } from '../auth.service';

@Injectable()
export class RefreshGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly sessionService: SessionService,
    ) {}
    
    canActivate = async (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromCookies(request);

        const { sessionId } = this.authService.verifyToken<{ sessionId: string }>(token, 'refresh');

        const session = await this.sessionService.validate(sessionId);

        request['doc'] = { session };

        return true;
    };

    private extractTokenFromCookies = (req: Request): string => {
        if (Cookies.REFRESH_TOKEN in req.cookies) {
            return req.cookies[Cookies.REFRESH_TOKEN];
        }

        throw new AppException({ message: 'Unauthorized', errorCode: AppExceptionCode.MISSING_REFRESH_TOKEN }, HttpStatus.UNAUTHORIZED);
    };
}
