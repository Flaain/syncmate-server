import { z } from 'zod';
import { AppException } from '../exceptions/app.exception';

export const onlyLatinRegExp = /^[a-zA-Z0-9_\s]*$/;
export const allowCyrillicRegExp = /^[\p{L}0-9\s]*$/u;

export const noSearchResults: Pick<AppException, 'message'> = {
    message: 'No results were found for your search',
}

export const passwordForSchema = z
    .string()
    .trim()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters long')
    .max(32, 'Password must be at most 32 characters long');

export const nameForSchema = z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(32, 'Name must be at most 32 characters long');

export const loginForSchema = z
    .string()
    .trim()
    .min(5, 'Login must be at least 5 characters long')
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
    'fchat',
    'admin',
    'administrator',
    'moderator',
    'root',
    'support',
    'system',
    'superuser',
    'guest',
    'owner',
    'webmaster',
    'info',
    'help',
    'service',
    'user',
    'test',
    'manager',
    'operator',
    'developer',
    'staff',
    'team',
    'bot',
    'noreply',
    'contact',
    'account',
    'billing',
    'sales',
    'security',
    'operations',
    'network',
    'sysadmin',
    'customer',
    'official',
    'qa',
    'techsupport',
    'api',
    'maintenance',
    'monitoring',
];