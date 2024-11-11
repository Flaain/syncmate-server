import { Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { Pagination, RequestWithUser, Routes } from 'src/utils/types';
import { CheckType } from './types';
import { UserStatusDTO } from './dtos/user.status.dto';
import { UserNameDto } from './dtos/user.name.dto';
import { PaginationResolver } from 'src/utils/services/pagination/patination.resolver';
import { Pagination as PaginationDecorator } from 'src/utils/decorators/pagination';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import { filePipe } from './constants';
import { AccessGuard } from '../auth/guards/auth.access.guard';
import { CONVERSATION_EVENTS } from '../conversation/types';
import { paramPipe } from 'src/utils/constants';

@Controller(Routes.USER)
export class UserController extends PaginationResolver {
    constructor(
        private readonly userService: UserService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        super();
    }

    @Get('search')
    @UseGuards(AccessGuard)
    async search(@Req() req: RequestWithUser, @PaginationDecorator() params: Pagination) {
        const items = await this.userService.search({ initiatorId: req.doc.user._id, ...params });

        return this.wrapPagination({ ...params, items });
    }

    @Get('check')
    check(@Query('type') type: CheckType, @Query('email') email: string, @Query('login') login: string) {
        return this.userService.check({ type, email, login });
    }

    @Post('status')
    @UseGuards(AccessGuard)
    status(@Req() req: RequestWithUser, @Body() { status }: UserStatusDTO) {
        return this.userService.status({ initiator: req.doc.user, status });
    }

    @Post('name')
    @UseGuards(AccessGuard)
    name(@Req() req: RequestWithUser, @Body() { name }: UserNameDto) {
        return this.userService.name({ initiator: req.doc.user, name });
    }

    @Post('block/:id')
    @UseGuards(AccessGuard)
    async block(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        const { recipientId } = await this.userService.block({ initiator: req.doc.user, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_BLOCK, { recipientId, initiatorId: req.doc.user._id.toString() });

        return { recipientId };
    }

    @Post('unblock/:id')
    @UseGuards(AccessGuard)
    async unblock(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        const { recipientId } = await this.userService.unblock({ initiator: req.doc.user, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_UNBLOCK, { recipientId, initiatorId: req.doc.user._id.toString() });

        return { recipientId };
    }

    @Post('avatar')
    @UseGuards(AccessGuard)
    @UseInterceptors(FileInterceptor('image'))
    avatar(@Req() req: RequestWithUser, @UploadedFile(filePipe) file: Express.Multer.File) {
        return this.userService.changeAvatar({ initiator: req.doc.user, file });
    }
}