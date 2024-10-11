import { Injectable } from '@nestjs/common';
import { CookieOptions, Response } from 'express';
import { DatesService } from '../dates/dates.service';
import { AuthCookiesName } from 'src/utils/types';

export const REFRESH_PATH = '/auth/refresh';

@Injectable()
export class CookiesService {
    private readonly cookieDefault: CookieOptions = {
        sameSite: 'strict',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
    };

    parseCookies(cookies: string) {
        if (!cookies) return {};

        return Object.fromEntries(cookies.split(';').map((cookie) => {
            const [key, value] = cookie.split('=');

            return [decodeURIComponent(key.trim()), decodeURIComponent(value.trim())];
        }))
    }

    setAccessToken(res: Response, accessToken: string) {
        res.cookie(AuthCookiesName.ACCESS_TOKEN, accessToken, {
            ...this.cookieDefault,
            expires: DatesService.fifteenMinutesFromNow(),
        });

        return this;
    }

    setRefreshToken(res: Response, refreshToken: string) {
        res.cookie(AuthCookiesName.REFRESH_TOKEN, refreshToken, {
            ...this.cookieDefault,
            expires: DatesService.oneMonthFromNow(),
            path: REFRESH_PATH,
        });

        return this;
    }

    setAuthCookies({ res, accessToken, refreshToken }: { res: Response; accessToken: string; refreshToken: string }) {
        this.setAccessToken(res, accessToken).setRefreshToken(res, refreshToken);

        return this;
    }

    removeAuthCookies(res: Response) {
        res.clearCookie(AuthCookiesName.ACCESS_TOKEN).clearCookie(AuthCookiesName.REFRESH_TOKEN, {
            path: REFRESH_PATH,
        });

        return this;
    }
}