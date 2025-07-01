import { Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileInterceptor } from '@nestjs/platform-express';
import { paramPipe } from 'src/utils/constants';
import { Pagination } from 'src/utils/decorators/pagination.decorator.';
import { IPagination, RequestWithUser, Routes } from 'src/utils/types';
import { CONVERSATION_EVENTS } from '../conversation/types';
import { filePipe } from './constants';
import { CheckType, UserEditDTO, UserPrivacySettingModeDTO } from './types';
import { UserService } from './user.service';
import { Public } from 'src/utils/decorators/public.decorator';
import { DTO } from 'src/utils/decorators/dto.decorator';
import { userEditSchema } from './schemas/user.edit.schema';
import { userPrivacySettingModeSchema } from './schemas/user.settings.privacy.mode.schema';

@Controller(Routes.USER)
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly eventEmitter: EventEmitter2,
    ) {}
    
    @Get('search')
    search(@Req() req: RequestWithUser, @Pagination() params: IPagination) {
        return this.userService.search({ initiatorId: req.doc.user._id, ...params });

    }

    @Public()
    @Get('check')
    check(@Query('type') type: CheckType, @Query('email') email: string | undefined, @Query('login') login: string | undefined) {
        return this.userService.check({ type, email, login });
    }
    
    @Post('block/:id')
    async block(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        const { recipientId } = await this.userService.block({ initiator: req.doc.user, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_BLOCK, { recipientId, initiatorId: req.doc.user._id.toString() });

        return { recipientId };
    }

    @Post('unblock/:id')
    async unblock(@Req() req: RequestWithUser, @Param('id', paramPipe) id: string) {
        const { recipientId } = await this.userService.unblock({ initiator: req.doc.user, recipientId: id });

        this.eventEmitter.emit(CONVERSATION_EVENTS.USER_UNBLOCK, { recipientId, initiatorId: req.doc.user._id.toString() });

        return { recipientId };
    }

    @Post('avatar')
    @UseInterceptors(FileInterceptor('image'))
    avatar(@Req() req: RequestWithUser, @UploadedFile(filePipe) file: Express.Multer.File) {
        return this.userService.changeAvatar({ initiator: req.doc.user, file });
    }

    @Patch('edit')
    edit(@Req() { doc: { user } }: RequestWithUser, @DTO(userEditSchema) dto: UserEditDTO) {
        return this.userService.edit(dto, user);
    }

    @Get('settings/privacy')
    getPrivacySettings(@Req() req: RequestWithUser) {
        return this.userService.getPrivacySettings(req.doc.user);
    }
    
    @Patch('settings/privacy/mode')
    updatePrivacySettingMode(@Req() req: RequestWithUser, @DTO(userPrivacySettingModeSchema) dto: UserPrivacySettingModeDTO) {
        return this.userService.updatePrivacySettingMode({ initiator: req.doc.user, dto });
    }
}