import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { SessionService } from 'src/modules/session/session.service';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from 'src/utils/decorators/public.decorator';
import { BaseAuthGuard } from './auth.base.guard';

@Injectable()
export class AccessGuard extends BaseAuthGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly sessionService: SessionService,
        private readonly reflector: Reflector
    ) {
        super();
    }

    canActivate = async (context: ExecutionContext) => {
        if (this.reflector.get<boolean>(PUBLIC_KEY, context.getHandler())) return true;

        const request = context.switchToHttp().getRequest<Request>();

        const { userId, sessionId } = this.authService.verifyToken<{ userId: string; sessionId: string }>(this.extractTokenFromCookies(request, 'access'), 'access');

        const session = await this.sessionService.validate(sessionId);
        const user = await this.authService.validate(userId);

        request['doc'] = { user, session };

        return true;
    };
}