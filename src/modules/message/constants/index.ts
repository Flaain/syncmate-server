import { PipeTransform } from '@nestjs/common';
import { validateParamId } from 'src/utils/helpers/validateParamId';

export const paramPipe: PipeTransform = {
    transform: validateParamId,
};