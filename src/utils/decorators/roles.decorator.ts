import { SetMetadata } from '@nestjs/common';
import { ERoles } from 'src/modules/auth/types';

export const Roles = (...roles: Array<ERoles>) => SetMetadata(Roles.name, roles);