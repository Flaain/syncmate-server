import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { AuthCookiesName, JWT_KEYS } from "src/utils/types";
import { SessionService } from "src/modules/session/session.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(
        private readonly configService: ConfigService,
        private readonly sessionService: SessionService
    ) {
        super({
            jwtFromRequest: AuthRefreshStrategy.extractJWT,
            secretOrKey: configService.get<string>(JWT_KEYS.REFRESH_TOKEN_SECRET),
            ignoreExpiration: false,
        });
    }

    private static extractJWT = (req: Request) => (AuthCookiesName.REFRESH_TOKEN in req.cookies) ? req.cookies[AuthCookiesName.REFRESH_TOKEN] : null;

    validate = async ({ sessionId }: { sessionId: string }) => {
        const session = await this.sessionService.validate(sessionId);
        
        return { session }; // <-- this is stupid. Cuz validate return, puts user object in request. So i decided to return object session for user.session instead of user as session
    };
}