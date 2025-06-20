import { HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { AppException } from 'src/utils/exceptions/app.exception';
import { AppExceptionCode, Cookies } from 'src/utils/types';
import { TokenType } from '../types';

export abstract class BaseAuthGuard {
    protected extractTokenFromCookies = (req: Request, type: TokenType): string => {
        const isAccess = type === 'access';
        const key = isAccess ? Cookies.ACCESS_TOKEN : Cookies.REFRESH_TOKEN;

        if (key in req.cookies) return req.cookies[key];

        throw new AppException(
            {
                message: 'Unauthorized',
                errorCode: isAccess ? AppExceptionCode.MISSING_ACCESS_TOKEN : AppExceptionCode.MISSING_REFRESH_TOKEN,
            },
            HttpStatus.UNAUTHORIZED,
        );
    };
}