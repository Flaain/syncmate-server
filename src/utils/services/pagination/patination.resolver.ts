import { HttpStatus, Injectable } from '@nestjs/common';
import { noSearchResults } from 'src/utils/constants';
import { AppException } from 'src/utils/exceptions/app.exception';
import { IPaginationResolver, PaginationWrapper } from 'src/utils/types';

@Injectable()
export class PaginationResolver implements IPaginationResolver {
    wrapPagination = <T>({ page, limit, items, onSuccess }: PaginationWrapper<T>) => {
        const total_items = items.slice(page * limit > items.length ? page : page * limit, page * limit + limit);

        if (!total_items.length) throw new AppException(noSearchResults, HttpStatus.NOT_FOUND);

        return {
            items: onSuccess ? onSuccess(total_items) : total_items,
            total_items: total_items.length,
            current_page: page,
            total_pages: Math.ceil(total_items.length / limit),
            remaining_items: Math.max(total_items.length - (page + 1) * limit, 0),
        };
    };
}