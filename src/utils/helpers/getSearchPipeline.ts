import { PipelineStage } from 'mongoose';
import { SearchPipelineParams } from '../types';

export const getSearchPipeline = ({ limit, page, pipeline }: Pick<SearchPipelineParams, 'limit' | 'page' | 'pipeline'>): Array<PipelineStage> => [
    { $facet: { data: pipeline } },
    {
        $addFields: {
            meta: {
                total_items: { $size: '$data' },
                remaining_items: { $max: [{ $subtract: [{ $size: '$data' }, (page + 1) * limit] }, 0] },
                total_pages: { $ceil: { $divide: [{ $size: '$data' }, limit] } },
                current_page: page,
                next_page: {
                    $cond: {
                        if: { $gt: [{ $ceil: { $divide: [{ $size: '$data' }, limit] } }, page + 1] },
                        then: page + 1,
                        else: null,
                    },
                },
            },
        },
    },
    { $project: { items: { $slice: ['$data', page * limit, limit] }, meta: 1 } },
];