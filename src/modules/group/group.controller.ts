import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequestWithUser, Routes } from 'src/utils/types';
import { GroupService } from './group.service';
import { CreateGroupDTO } from './dtos/create.group.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { paramPipe } from 'src/utils/constants';

@Auth()
@Controller(Routes.GROUP)
export class GroupController {
    constructor(private readonly groupService: GroupService) {}

    @Post('create')
    create(@Req() { doc: { user } }: RequestWithUser, @Body() dto: CreateGroupDTO) {
        return this.groupService.createGroup({ ...dto, initiator: user });
    }

    @Get(':id')
    getGroup(@Req() { doc: { user } }: RequestWithUser, @Param('id', paramPipe) groupId: string, @Query('invite') invite?: string) {
        return this.groupService.getGroup({ groupId, initiator: user, invite });
    }

    @Get(':id/participants')
    getParticipants(@Req() { doc: { user } }: RequestWithUser, @Param('id', paramPipe) groupId: string, @Query('cursor') cursor?: string) {
        return this.groupService.getParticipants({ groupId, cursor, initiator: user });
    }
}