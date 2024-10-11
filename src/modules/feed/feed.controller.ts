import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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
    getFeed(@Req() req: RequestWithUser) {
        return this.feedService.getFeed({ initiatorId: req.user.doc._id });
    }

    @Get('search')
    @UseGuards(AccessGuard)
    async search(@Req() req: RequestWithUser, @PaginationDecorator() params: Pagination) {
        const [users, groups] = await this.feedService.search({ ...params, initiatorId: req.user.doc._id });

        return this.wrapPagination({ 
            ...params, 
            items: [...users, ...groups],
            onSuccess: (items) => items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((item) => ({ 
                ...item.toObject(), 
                type: item.collection.name[0].toUpperCase() + item.collection.name.slice(1, -1)
            }))
        });
    }
}