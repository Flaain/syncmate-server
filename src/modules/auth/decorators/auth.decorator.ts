import { UseGuards, applyDecorators } from '@nestjs/common';
import { ERoles } from '../types';
import { Roles } from 'src/utils/decorators/roles.decorator';
import { AccessGuard } from '../guards/auth.access.guard';
import { RolesGuard } from '../guards/roles.guard';

export const Auth = (...roles: Array<ERoles>) => roles.length ? applyDecorators(Roles(...roles), UseGuards(AccessGuard, RolesGuard)) : UseGuards(AccessGuard);
