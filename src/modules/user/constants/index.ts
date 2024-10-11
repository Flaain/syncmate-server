import { FileTypeValidator, MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';

export const MAX_IMAGE_SIZE = 5 * 1024 ** 2;
export const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
export const imageTypeRegex = new RegExp(`^(${validImageTypes.join('|')})$`);

export const filePipe = new ParseFilePipe({
    fileIsRequired: true,
    validators: [
        new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE, message: 'Max file size is 5MB' }),
        new FileTypeValidator({ fileType: imageTypeRegex }),
    ],
});