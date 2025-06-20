import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(request: Request, response: Response, next: NextFunction) {
        const { method, originalUrl, ip } = request;

        const userAgent = request.get('user-agent') || 'Unknown';
        const startTime = Date.now();
        const requestId = this.generateRequestId();

        // Add request ID to request object for tracing
        request['requestId'] = requestId;

        // Set request ID header
        response.setHeader('X-Request-ID', requestId);

        this.logger.log(`→ ${method} ${originalUrl} - ${ip} ${userAgent} [${requestId}]`);

        response.on('finish', () => {
            const { statusCode } = response;

            const contentLength = response.get('content-length') || 0;
            const responseTime = Date.now() - startTime;

            this.logger[statusCode >= 400 ? 'warn' : 'log'](`${this.getStatusIcon(statusCode)} ${method} ${originalUrl} ${statusCode} ${contentLength}b - ${responseTime}ms [${requestId}]`);
        });

        response.on('error', error => {
            this.logger.error(`✖ ${method} ${originalUrl} - Request failed [${requestId}]`, error);
        });

        next();
    }

    private generateRequestId() {
        return (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    }

    private getStatusIcon(statusCode: number) {
        if (statusCode >= 200 && statusCode < 300) return '✓';
        if (statusCode >= 300 && statusCode < 400) return '→';
        if (statusCode >= 400 && statusCode < 500) return '⚠';
        if (statusCode >= 500) return '✖';
        
        return '?';
    }
}