import { HttpAdapterHost } from '@nestjs/core';
import { AppException } from '../exceptions/app.exception';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { Request, Response } from 'express';
import { CookiesService, REFRESH_PATH } from '../services/cookies/cookies.service';
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpStatus,
    UnauthorizedException,
    NotFoundException,
} from '@nestjs/common';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
    constructor(
        private readonly httpAdapterHost: HttpAdapterHost,
        private readonly cookiesService: CookiesService,
    ) {}

    private readonly exceptionHandlers = {
        [AppException.name]: this.handleAppException.bind(this),
        [ZodValidationException.name]: this.handleZodValidationException.bind(this),
        [ZodError.name]: this.handleZodError.bind(this),
        [UnauthorizedException.name]: this.handleUnauthorizedException.bind(this),
        [NotFoundException.name]: this.handleNotFoundException.bind(this),
    };

    private handleAppException(exception: AppException) {
        return {
            message: exception.message,
            errorCode: exception.errorCode,
            statusCode: exception.statusCode,
            errors: exception.errors,
        };
    }

    private handleNotFoundException(exception: NotFoundException) {
        return {
            message: exception.message,
            statusCode: exception.getStatus(),
        };
    }

    private handleUnauthorizedException(exception: UnauthorizedException, request: Request, response: Response) {
        request.url === REFRESH_PATH && this.cookiesService.removeAuthCookies(response);

        return {
            message: exception.message,
            statusCode: exception.getStatus(),
        };
    }

    private handleZodValidationException(exception: ZodValidationException) {
        return {
            message: exception.message,
            statusCode: exception.getStatus(),
            errors: exception.getZodError().issues.map(({ path: [path], message }) => ({ path, message })),
        };
    }

    private handleZodError(exception: ZodError) {
        return {
            message: 'Bad request',
            errors: exception.issues.map(({ path: [path], message }) => ({ path, message })),
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        };
    }

    catch(exception: unknown, host: ArgumentsHost) {
        const { httpAdapter } = this.httpAdapterHost;
console.log(exception);
        const ctx = host.switchToHttp();

        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();

        const handlerReturn = this.exceptionHandlers[exception.constructor.name]?.(exception, request, response);

        return httpAdapter.reply(response, {
            url: request.url,
            timestamp: new Date().toISOString(),
            message: 'Internal server error',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            ...(handlerReturn ? handlerReturn : {}),
        }, handlerReturn?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR);
    }
}