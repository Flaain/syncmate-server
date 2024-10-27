import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccessGuard } from 'src/utils/guards/access.guard';
import { Pagination, RequestWithUser, Routes } from 'src/utils/types';
import { FeedService } from './feed.service';
import { Pagination as PaginationDecorator } from 'src/utils/decorators/pagination';
import { PaginationResolver } from 'src/utils/services/pagination/patination.resolver';

@Controller(Routes.FEED)
export class FeedController extends PaginationResolver {
    constructor(private readonly feedService: FeedService) {
        super();
    }

    @Get()
    @UseGuards(AccessGuard)
    getFeed(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
        return this.feedService.getFeed({ initiatorId: req.user.doc._id, cursor });
    }

    @Get('search')
    @UseGuards(AccessGuard)
    async search(@Req() req: RequestWithUser, @PaginationDecorator() params: Pagination) {
        return this.feedService.search({ ...params, initiatorId: req.user.doc._id });
    }
}