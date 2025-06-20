import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ERoles } from '../types';
import { Roles } from 'src/utils/decorators/roles.decorator';
import { AccessGuard } from '../guards/auth.access.guard';
import { RolesGuard } from '../guards/roles.guard';

export const Authorization = (...roles: Array<ERoles>) => roles.length ? applyDecorators(SetMetadata(Roles.name, roles), UseGuards(AccessGuard, RolesGuard)) : UseGuards(AccessGuard);
