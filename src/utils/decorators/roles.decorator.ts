import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { ERoles } from 'src/modules/auth/types';

export const Roles = (...roles: Array<ERoles>) => applyDecorators(SetMetadata(Roles.name, roles), UseGuards(RolesGuard));
