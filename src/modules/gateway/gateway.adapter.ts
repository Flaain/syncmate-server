import { HttpStatus } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppException } from 'src/utils/exceptions/app.exception';
import { AuthService } from '../auth/auth.service';
import { CookiesService } from 'src/utils/services/cookies/cookies.service';
import { Server as IOServer, ServerOptions } from 'socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IncomingMessage, Server, ServerResponse } from 'http';

export class GatewayAdapter extends IoAdapter {
    constructor(private readonly app: NestExpressApplication<Server<typeof IncomingMessage, typeof ServerResponse>>) {
        super(app);
    }

    createIOServer(port: number, options?: ServerOptions) {
        const server: IOServer = super.createIOServer(port, options);
        
        server.use(async (socket, next) => {
            try {
                const cookies = socket.handshake.headers.cookie;

                if (!cookies) throw new AppException({ message: 'Missing authorization cookies' }, HttpStatus.UNAUTHORIZED);

                const { accessToken } = this.app.get(CookiesService).parseCookies(cookies);

                if (!accessToken) throw new AppException({ message: 'Missing access token' }, HttpStatus.UNAUTHORIZED);
                
                const authService = this.app.get(AuthService);
                
                const { userId } = authService.verifyToken(accessToken, 'access');

                socket.data.user = await authService.validate(userId);

                return next();
            } catch (error) {
                console.log(error);

                return next({ message: 'An error occurred during authorization', name: 'Unauthorized_Exception', data: error });
            }
        });

        return server;
    }
}
