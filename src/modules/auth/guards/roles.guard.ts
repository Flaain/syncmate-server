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
        const roles = this.reflector.getAllAndOverride<Array<ERoles>>(Roles.name, [context.getClass(), context.getHandler()]);

        if (!roles || !roles.length) return true;

        const request = context.switchToHttp().getRequest<RequestWithUser>();

        if (!roles.includes(request.doc.user.role)) throw new AppException({ message: 'Forbidden' }, HttpStatus.FORBIDDEN);

        return true;
    };
}
