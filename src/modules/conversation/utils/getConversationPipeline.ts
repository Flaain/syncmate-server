import { PipelineStage, Types } from 'mongoose';
import { MESSAGES_BATCH } from 'src/shared/constants';

const PREV = 10;

export const getConversationPipeline = (
    initiatorId: Types.ObjectId,
    recipientId: Types.ObjectId,
): Array<PipelineStage> => [
    { $match: { participants: { $all: [initiatorId, recipientId] } } },
    {
        $lookup: {
            from: 'messages',
            localField: 'messages',
            foreignField: '_id',
            as: 'all_messages',
            pipeline: [
                {
                    $addFields: {
                        hasBeenRead: {
                            $cond: {
                                if: { $and: [{ $eq: ['$sender', initiatorId] }, { $in: [recipientId, '$readedBy'] }] },
                                then: true,
                                else: '$$REMOVE',
                            },
                        },
                        alreadyRead: {
                            $cond: {
                                if: { $and: [{ $eq: ['$sender', recipientId] }, { $in: [initiatorId, '$readedBy'] }] },
                                then: true,
                                else: '$$REMOVE',
                            },
                        },
                    },
                },
                {
                    $lookup: {
                        from: 'messages',
                        localField: 'replyTo',
                        foreignField: '_id',
                        as: 'replyTo',
                        pipeline: [{ $project: { text: 1 } }],
                    },
                },
                { $unwind: { path: '$replyTo', preserveNullAndEmptyArrays: true } },
                { $sort: { createdAt: 1 } },
                { $project: { readedBy: 0, replies: 0 } },
            ],
        },
    },
    { 
        $addFields: {
            oldest_unread: {
                $first: {
                    $filter: {
                        input: '$all_messages',
                        as: 'message',
                        cond: { $and: [{ $eq: ['$$message.sender', recipientId] }, { $ifNull: ['$$message.alreadyRead', true] }] },
                    }
                }
            }
        }
    },
    {
        $project: {
            messages: {
                $let: {
                    vars: {
                        oldest_unread: '$$ROOT.oldest_unread',
                        all: '$$ROOT.all_messages',
                    },
                    in: {
                        $let: {
                            vars: {
                                oldest_unread_index: {
                                    $cond: {
                                        if: '$$oldest_unread',
                                        then: { $indexOfArray: ['$$all', '$$oldest_unread'] },
                                        else: -1,
                                    },
                                },
                            },
                            in: {
                                $let: {
                                    vars: {
                                        possible_start: {
                                            $cond: {
                                                if: { $eq: ['$$oldest_unread_index', -1] },
                                                then: { $max: [0, { $subtract: [{ $size: '$$all' }, MESSAGES_BATCH] }] },
                                                else: { $max: [0, { $subtract: ['$$oldest_unread_index', PREV] }] },
                                            },
                                        },
                                    },
                                    in: {
                                        $let: {
                                            vars: {
                                                available: {
                                                    $subtract: [{ $size: '$$all' }, '$$possible_start'],
                                                },
                                            },
                                            in: {
                                                $let: {
                                                    vars: {
                                                        shortfall: {
                                                            $cond: {
                                                                if: { $and: [{ $lt: ['$$available', MESSAGES_BATCH] }, { $ne: ['$$oldest_unread_index', -1] }] },
                                                                then: { $subtract: [MESSAGES_BATCH, '$$available'] },
                                                                else: 0,
                                                            },
                                                        },
                                                    },
                                                    in: {
                                                        $let: {
                                                            vars: {
                                                                startIndex: {
                                                                    $max: [0, { $subtract: ['$$possible_start', '$$shortfall'] }],
                                                                },
                                                            },
                                                            in: {
                                                                $let: {
                                                                    vars: {
                                                                        data: { $slice: ['$$all', '$$startIndex', MESSAGES_BATCH] },
                                                                    },
                                                                    in: {
                                                                        data: '$$data',
                                                                        prevCursor: {
                                                                            $cond: {
                                                                                if: { $gt: ['$$startIndex', 0] },
                                                                                then: {
                                                                                    $let: {
                                                                                        vars: {
                                                                                            prevMsg: { $arrayElemAt: ['$$all', { $subtract: ['$$startIndex', 1] }] },
                                                                                        },
                                                                                        in: '$$prevMsg._id'
                                                                                    }
                                                                                },
                                                                                else: null,
                                                                            },
                                                                        },
                                                                        nextCursor: {
                                                                            $cond: {
                                                                                if: { $gt: [{ $size: { $slice: ['$$all', '$$startIndex', MESSAGES_BATCH + 1] } }, MESSAGES_BATCH] },
                                                                                then: { $getField: { field: '_id', input: { $arrayElemAt: ['$$data', -1] } } },
                                                                                else: null,
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
];