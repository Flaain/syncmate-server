import { createParamDecorator } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Request } from 'express';
import { ZodSchema } from 'zod';

export const DTO = (schema: ZodSchema) => createParamDecorator((_, ctx: ExecutionContextHost) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    return schema.parse(request.body);
})();