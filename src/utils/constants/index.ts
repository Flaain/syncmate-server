import { PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from '../exceptions/app.exception';
import { validateParamId } from '../helpers/validateParamId';
import { isValidObjectId } from 'mongoose';

export const MESSAGES_BATCH = 25;

export const recipientProjection = {
    _id: 1,
    name: 1,
    login: 1,
    avatar: 1,
    isOfficial: 1,
    isPrivate: 1,
    presence: 1,
    lastSeenAt: 1,
};

export const paramPipe: PipeTransform = { transform: validateParamId };
export const defaultSuccessResponse = { message: 'OK' };

export const onlyLatinRegExp = /^[a-zA-Z0-9_\s]*$/;
export const allowCyrillicRegExp = /^[\p{L}0-9\s]*$/u;

export const noSearchResults: Pick<AppException, 'message'> = {
    message: 'No results were found for your search',
};

export const otpForSchema = z.string().trim().length(6, 'Invalid OTP code');

export const validObjId = z.string({ required_error: 'id is required' }).max(24, 'id is invalid').refine((id) => isValidObjectId(id), { message: `Invalid object id` })

export const passwordForSchema = z
    .string()
    .trim()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters long')
    .max(32, 'Password must be at most 32 characters long');

export const nameForSchema = z
    .string({ required_error: 'Name is required' })
    .trim()
    .max(32, 'Name must be at most 32 characters long');
    
export const searchSchema = z.strictObject({
    query: nameForSchema.trim().min(3, 'Search query must be at least 3 characters long'),
    page: z.number({ coerce: true }).min(0).default(0),
    limit: z
        .number({ coerce: true })
        .min(1, 'Limit must be between 1 and 10')
        .max(10, 'Limit must be between 1 and 10')
        .default(10),
});

export const loginForSchema = z
    .string()
    .trim()
    .min(4, 'Login must be at least 5 characters long')
    .max(32, 'Login must be at most 32 characters long')
    .toLowerCase()
    .regex(onlyLatinRegExp, 'Invalid login. Please use only a-z, 0-9 and underscore characters');

export const messageForSchema = z
    .string()
    .trim()
    .min(1, "Message can't be empty")
    .max(10000, "Message can't be longer than 10000 characters");

export const emailForSchema = z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .toLowerCase();

export const reservedLogins = [
    'syncmate',
    'admin',
    'administrator',
    'moderator',
    'root',
    'support',
    'system',
    'owner',
    'info',
    'help',
    'user',
    'test',
    'manager',
    'developer',
    'staff',
    'team',
    'noreply',
    'account',
    'official',
];