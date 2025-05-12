import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import { paramPipe } from 'src/utils/constants';
import { Pagination } from 'src/utils/decorators/pagination.decorator.';
import { IPagination, RequestWithUser, Routes } from 'src/utils/types';
import { Auth } from '../auth/decorators/auth.decorator';
import { CONVERSATION_EVENTS } from '../conversation/types';
import { filePipe } from './constants';
import { CheckType } from './types';
import { UserService } from './user.service';
import { UserEditDTO } from './dtos/user.edit.dto';

@Controller(Routes.USER)
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly eventEmitter: EventEmitter2,
    ) {}
    
    @Auth()
    @Get('search')
    search(@Req() req: RequestWithUser, @Pagination() params: IPagination) {
        return this.userService.search({ initiatorId: req.doc.user._id, ...params });

    }

    @Get('check')
    check(@Query('type') type: CheckType, @Query('email') email: string, @Query('login') login: string) {
        return this.userService.check({ type, email, login });
    }
    
    @Auth()
    @Post('block/:id')
    async block(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        const { recipientId } = await this.userService.block({ initiator: req.doc.user, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_BLOCK, { recipientId, initiatorId: req.doc.user._id.toString() });

        return { recipientId };
    }

    @Auth()
    @Post('unblock/:id')
    async unblock(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        const { recipientId } = await this.userService.unblock({ initiator: req.doc.user, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_UNBLOCK, { recipientId, initiatorId: req.doc.user._id.toString() });

        return { recipientId };
    }

    @Auth()
    @Post('avatar')
    @UseInterceptors(FileInterceptor('image'))
    avatar(@Req() req: RequestWithUser, @UploadedFile(filePipe) file: Express.Multer.File) {
        return this.userService.changeAvatar({ initiator: req.doc.user, file });
    }

    @Auth()
    @Patch('edit')
    edit(@Req() { doc: { user } }: RequestWithUser, @Body() dto: UserEditDTO) {
        return this.userService.edit(dto, user)
    }
}