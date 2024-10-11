import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequestWithUser, Routes } from 'src/utils/types';
import { GroupService } from './group.service';
import { AccessGuard } from 'src/utils/guards/access.guard';
import { CreateGroupDTO } from './dtos/create.group.dto';

@Controller(Routes.GROUP)
export class GroupController {
    constructor(private readonly groupService: GroupService) {}

    @Post('create')
    @UseGuards(AccessGuard)
    create(@Req() req: RequestWithUser, @Body() dto: CreateGroupDTO) {
        return this.groupService.createGroup({ ...dto, initiator: req.user.doc });
    }

    @Get(':id')
    @UseGuards(AccessGuard)
    getGroup(@Req() req: RequestWithUser, @Param('id') groupId: string, @Query('invite') invite?: string) {
        return this.groupService.getGroup({ groupId, initiator: req.user.doc, invite });
    }
}
