import { Controller, Get, Query, Req } from '@nestjs/common';
import { Pagination } from 'src/utils/decorators/pagination.decorator.';
import { IPagination, RequestWithUser, Routes } from 'src/utils/types';
import { Auth } from '../auth/decorators/auth.decorator';
import { FeedService } from './feed.service';

@Auth()
@Controller(Routes.FEED)
export class FeedController {
    constructor(private readonly feedService: FeedService) {}

    @Get()
    getFeed(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
        return this.feedService.getFeed({ initiatorId: req.doc.user._id, cursor });
    }

    @Get('search')
    search(@Req() { doc: { user } }: RequestWithUser, @Pagination() params: IPagination) {
        return this.feedService.search({ ...params, initiatorId: user._id });
    }
}