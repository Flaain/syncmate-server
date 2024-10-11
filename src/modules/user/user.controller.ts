import { Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { Pagination, RequestWithUser, Routes } from 'src/utils/types';
import { CheckType, IUserController } from './types';
import { AccessGuard } from 'src/utils/guards/access.guard';
import { UserStatusDTO } from './dtos/user.status.dto';
import { UserNameDto } from './dtos/user.name.dto';
import { PaginationResolver } from 'src/utils/services/pagination/patination.resolver';
import { Pagination as PaginationDecorator } from 'src/utils/decorators/pagination';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import { filePipe } from './constants';
import { CONVERSATION_EVENTS } from '../gateway/types';

@Controller(Routes.USER)
export class UserController extends PaginationResolver implements IUserController {
    constructor(
        private readonly userService: UserService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        super();
    }

    @Get('search')
    @UseGuards(AccessGuard)
    async search(@Req() req: RequestWithUser, @PaginationDecorator() params: Pagination) {
        const items = await this.userService.search({ initiatorId: req.user.doc._id, ...params });

        return this.wrapPagination({ ...params, items });
    }

    @Get('check')
    check(@Query('type') type: CheckType, @Query('email') email: string, @Query('login') login: string) {
        return this.userService.check({ type, email, login });
    }

    @Post('status')
    @UseGuards(AccessGuard)
    status(@Req() req: RequestWithUser, @Body() { status }: UserStatusDTO) {
        return this.userService.status({ initiator: req.user.doc, status });
    }

    @Post('name')
    @UseGuards(AccessGuard)
    name(@Req() req: RequestWithUser, @Body() { name }: UserNameDto) {
        return this.userService.name({ initiator: req.user.doc, name });
    }

    @Post('block/:id')
    @UseGuards(AccessGuard)
    async block(@Req() req: RequestWithUser, @Param('id') id: string) {
        const { recipientId } = await this.userService.block({ initiator: req.user.doc, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_BLOCK, {
            recipientId,
            initiatorId: req.user.doc._id.toString(),
        });

        return { recipientId };
    }

    @Post('unblock/:id')
    @UseGuards(AccessGuard)
    async unblock(@Req() req: RequestWithUser, @Param('id') id: string) {
        const { recipientId } = await this.userService.unblock({ initiator: req.user.doc, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_UNBLOCK, {
            recipientId,
            initiatorId: req.user.doc._id.toString(),
        });

        return { recipientId };
    }

    @Post('avatar')
    @UseGuards(AccessGuard)
    @UseInterceptors(FileInterceptor('image'))
    avatar(@Req() req: RequestWithUser, @UploadedFile(filePipe) file: Express.Multer.File) {
        return this.userService.changeAvatar({ initiator: req.user.doc, file });
    }
}