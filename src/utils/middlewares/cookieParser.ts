import { NextFunction, Request, Response } from 'express';

export const cookieParser = (req: Request, _: Response, next: NextFunction) => {
    try {
        const cookies = req.headers.cookie;

        if (!cookies) {
            req.cookies = {};

            return next();
        };

        req.cookies = Object.fromEntries(cookies.split(';').map((cookie) => {
            const [key, value] = cookie.split('=');

            return [decodeURIComponent(key.trim()), decodeURIComponent(value.trim())];
        }));

        next();
    } catch (error) {
        next(error);
    }
};