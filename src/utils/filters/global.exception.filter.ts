import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../exceptions/app.exception";
import { ZodError } from "zod";
import { AppExceptionErrors } from "../types";
import { Request, Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);
    private readonly isProduction: boolean;

    constructor(private readonly configService: ConfigService) {
        this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    }

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        
        const request = ctx.getRequest<Request>();
        const info = this.getExceptionInfo(exception);

        this.logError(request, exception, info.statusCode);

        ctx.getResponse<Response>().status(info.statusCode).json({
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            ...info,
        });
    }

    private logError(request: Request, exception: unknown, statusCode: number) {
        const { method, url, body, query, headers } = request;

        const userAgent = headers['user-agent'] || 'Unknown';

        const str = JSON.stringify(
            {
                method,
                url,
                statusCode,
                userAgent,
                // body: this.sanitizeBody(body),
                query,
            },
            null,
            2,
        );

        if (statusCode >= 500) {
            this.logger.error(`Server Error: ${method} ${url}`, exception instanceof Error ? exception.stack : exception, str);
        } else if (statusCode >= 400) {
            this.logger.warn(`Client Error: ${method} ${url} - ${statusCode}`, str);
        }
    }

    private getExceptionInfo(exception: unknown): { message: string; statusCode: number; errors?: AppExceptionErrors } {
        if (exception instanceof ZodError) {
            return {
                message: 'Bad request',
                errors: exception.issues.map(({ path: [path], message }) => ({ path, message })),
                statusCode: HttpStatus.BAD_REQUEST
            }
        }
        
        if (exception instanceof AppException) {
            return {
                message: exception.message,
                statusCode: exception.statusCode,
                errors: exception.errors
            }
        }

        if (exception instanceof HttpException) {
            return {
                message: exception.message,
                statusCode: exception.getStatus()
            }
        }

        return {
            message: 'Internal server error',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR
        }
    }
}