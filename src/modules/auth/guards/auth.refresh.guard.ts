import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RefreshGuard implements CanActivate {
    canActivate = (context: ExecutionContext) => {
        const { getRequest, getResponse } = context.switchToHttp();
    };
}