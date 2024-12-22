export const PARTICIPANT_BATCH = 10;
export const messageSenderPipeline = {
    $lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'sender',
        pipeline: [
            {
                $lookup: {
                    from: 'participants',
                    let: { userId: '$user' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [{ $eq: ['$$userId', '$user'] }, { $eq: ['$$groupId', '$group'] }],
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: 'files',
                                localField: 'avatar',
                                foreignField: '_id',
                                as: 'avatar',
                                pipeline: [{ $project: { _id: 1, url: 1 } }],
                            },
                        },
                        { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                    ],
                    as: 'participant',
                },
            },
            { $unwind: { path: '$participant', preserveNullAndEmptyArrays: true } },
            { $project: { name: 1, login: 1, isOfficial: 1, participant: 1 } },
        ],
    },
};