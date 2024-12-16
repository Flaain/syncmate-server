import { Controller, Delete, Get, Param, Req } from '@nestjs/common';
import { RequestWithUser, Routes } from 'src/utils/types';
import { SessionService } from './session.service';
import { Auth } from '../auth/decorators/auth.decorator';

@Auth()
@Controller(Routes.SESSION)
export class SessionController {
    constructor(private readonly sessionService: SessionService) {}

    @Get()
    getSessions(@Req() req: RequestWithUser) {
        return this.sessionService.getSessions({ userId: req.doc.user._id.toString(), sessionId: req.doc.sessionId });
    }

    @Delete()
    terminateAllSessions(@Req() req: RequestWithUser) {
        return this.sessionService.terminateAllSessions({
            initiatorSessionId: req.doc.sessionId,
            initiatorUserId: req.doc.user._id.toString(),
        });
    }

    @Delete(':sessionId')
    dropSession(@Req() req: RequestWithUser, @Param('sessionId') sessionId: string) {
        return this.sessionService.dropSession({
            initiatorUserId: req.doc.user._id.toString(),
            initiatorSessionId: req.doc.sessionId,
            sessionId: sessionId,
        });
    }
}