import { IAppException } from 'src/utils/types';

export const loginExistError: Pick<IAppException, 'message' | 'errors'> = {
    message: 'Login already exists',
    errors: [{ message: 'Login already exists', path: 'login' }],
};

export const emailExistError: Pick<IAppException, 'message' | 'errors'> = {
    message: 'Email already exists',
    errors: [{ message: 'Email already exists', path: 'email' }],
};

export const otpError: Pick<IAppException, 'message' | 'errors' | 'errorCode'> = {
    message: 'An error occurred during the registration process. Please try again.',
    errors: [{ message: 'Invalid OTP code', path: 'otp' }],
};

export const incorrectPasswordError: Pick<IAppException, 'message' | 'errors'> = {
    message: 'Incorrect password',
    errors: [{ path: 'currentPassword', message: 'Incorrect password' }],
};