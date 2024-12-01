import { isValidObjectId } from 'mongoose';
import { AppException } from '../exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

export const validateParamId = (value: string) => {
    if (!isValidObjectId(value)) throw new AppException({ message: 'Invalid object id' }, HttpStatus.BAD_REQUEST);

    return value;
};