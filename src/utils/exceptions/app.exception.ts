import { HttpStatus } from '@nestjs/common';
import { AppExceptionCode, AppExceptionErrors, IAppException, ImplementAppException } from '../types';

export class AppException extends Error implements ImplementAppException {
    public errorCode?: AppExceptionCode;
    public errors?: AppExceptionErrors;

    constructor(error: IAppException, public statusCode: HttpStatus) {
        super(error.message);

        Object.assign(this, error);
    }

    getStatusCode() {
        return this.statusCode;
    }

    getErrorCode() {
        return this.errorCode;
    }
}
