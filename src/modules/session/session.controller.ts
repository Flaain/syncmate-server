import { Controller, Delete, Get, Param, Req, UseGuards } from '@nestjs/common';
import { RequestWithUser, Routes } from 'src/utils/types';
import { SessionService } from './session.service';
import { AccessGuard } from 'src/utils/guards/access.guard';

@Controller(Routes.SESSION)
export class SessionController {
    constructor(private readonly sessionService: SessionService) {}

    @Get()
    @UseGuards(AccessGuard)
    getSessions(@Req() req: RequestWithUser) {
        return this.sessionService.getSessions({ userId: req.user.doc._id.toString(), sessionId: req.user.sessionId });
    }

    @Delete()
    @UseGuards(AccessGuard)
    terminateAllSessions(@Req() req: RequestWithUser) {
        return this.sessionService.terminateAllSessions({
            initiatorSessionId: req.user.sessionId,
            initiatorUserId: req.user.doc._id.toString(),
        });
    }

    @Delete(':sessionId')
    @UseGuards(AccessGuard)
    dropSession(@Req() req: RequestWithUser, @Param('sessionId') sessionId: string) {
        return this.sessionService.dropSession({
            initiatorUserId: req.user.doc._id.toString(),
            initiatorSessionId: req.user.sessionId,
            sessionId: sessionId,
        });
    }
}