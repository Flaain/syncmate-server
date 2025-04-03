import { FileTypeValidator, MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';
import { emailExistError, loginExistError } from 'src/modules/auth/constants';
import { IAppException } from 'src/utils/types';
import { z } from 'zod';
import { userCheckSchema } from '../schemas/user.check.schema';

export const MAX_IMAGE_SIZE = 5 * 1024 ** 2;
export const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg'];

export const filePipe = new ParseFilePipe({
    fileIsRequired: true,
    validators: [
        new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE, message: 'Max file size is 5MB' }),
        new FileTypeValidator({ fileType: new RegExp(`^(${validImageTypes.join('|')})$`) }),
    ],
});

export const checkErrors: Record<z.infer<typeof userCheckSchema>['type'], Pick<IAppException, 'message' | 'errors'>> = {
    email: emailExistError,
    login: loginExistError,
};