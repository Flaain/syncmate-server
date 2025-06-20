import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from 'src/modules/session/session.service';
import { AuthService } from '../auth.service';
import { BaseAuthGuard } from './auth.base.guard';

@Injectable()
export class RefreshGuard extends BaseAuthGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly sessionService: SessionService,
    ) {
        super();
    }

    canActivate = async (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest<Request>();

        const { sessionId } = this.authService.verifyToken<{ sessionId: string }>(this.extractTokenFromCookies(request, 'refresh'), 'refresh');

        const session = await this.sessionService.validate(sessionId);

        request['doc'] = { session };

        return true;
    };
}