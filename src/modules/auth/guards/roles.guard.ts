import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/utils/decorators/roles.decorator';
import { AppException } from 'src/utils/exceptions/app.exception';
import { RequestWithUser } from 'src/utils/types';
import { ERoles } from '../types';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate = (context: ExecutionContext) => {
        const roles = this.reflector.getAllAndOverride<Array<ERoles>>(Roles.name, [context.getHandler(), context.getClass()]);

        if (!roles || !roles.length) return true;

        if (!roles.includes(context.switchToHttp().getRequest<RequestWithUser>().doc.user.role)) throw new AppException({ message: 'Forbidden' }, HttpStatus.FORBIDDEN);

        return true;
    };
}