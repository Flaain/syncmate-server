import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { searchSchema } from '../constants';

export const Pagination = createParamDecorator((_, ctx: ExecutionContext) => searchSchema.parse(ctx.switchToHttp().getRequest<Request>().query, { path: ['query'] }));