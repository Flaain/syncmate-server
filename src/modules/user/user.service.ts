import { z } from 'zod';
import { User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { userCheckSchema } from './schemas/user.check.schema';
import { AppException } from 'src/utils/exceptions/app.exception';
import { UserDocument, UserSearchParams } from './types';
import { Model, Types } from 'mongoose';
import { Providers } from 'src/utils/types';
import { UserStatusDTO } from './dtos/user.status.dto';
import { UserNameDto } from './dtos/user.name.dto';
import { BaseService } from 'src/utils/services/base/base.service';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileService } from '../file/file.service';
import { checkErrors } from './constants';
import { defaultSuccessResponse } from 'src/utils/constants';
import { BlockList } from './schemas/user.blocklist.schema';
import { recipientProjection } from '../conversation/constants';

@Injectable()
export class UserService extends BaseService<UserDocument, User> {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(BlockList.name) private readonly blocklistModel: Model<BlockList>,
        @Inject(Providers.S3_CLIENT) private readonly s3: S3Client,
        private readonly fileService: FileService
    ) {
        super(userModel);
    }

    block = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        if (initiator._id.toString() === recipientId || await this.blocklistModel.exists({ user: initiator._id, blockList: { $in: [recipientId] } })) {
            throw new AppException({ message: 'Cannot block user' }, HttpStatus.BAD_REQUEST);
        }

        const recipient = await this.findById(recipientId);

        if (!recipient) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);

        await this.blocklistModel.findOneAndUpdate({ user: initiator._id }, { $push: { blockList: recipient._id } }, { upsert: true });

        return { recipientId: recipient._id.toString() };
    }

    unblock = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        if (initiator._id.toString() === recipientId || !await this.blocklistModel.exists({ user: initiator._id, blockList: { $in: [recipientId] } })) {
            throw new AppException({ message: 'Cannot unblock user' }, HttpStatus.BAD_REQUEST);
        }

        const recipient = await this.findById(recipientId);

        if (!recipient) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);

        await this.blocklistModel.findOneAndUpdate({ user: initiator._id }, { $pull: { blockList: recipient._id } });

        return { recipientId: recipient._id.toString() };
    }

    search = async ({ initiatorId, query, page, limit }: UserSearchParams) => {
        const users = await this.find({
            filter: {
                _id: { $ne: initiatorId },
                $or: [{ name: { $regex: query, $options: 'i' } }, { login: { $regex: query, $options: 'i' } }],
                isPrivate: false,
                isDeleted: false,
            },
            projection: { _id: 1, name: 1, login: 1, isOfficial: 1 },
            options: { limit, skip: page * limit, sort: { createdAt: -1 } },
        }).lean();

        return users;
    };

    check = async (dto: z.infer<typeof userCheckSchema>) => {
        const parsedQuery = userCheckSchema.parse(dto);

        const user = await this.exists({
            [parsedQuery.type]: { $regex: parsedQuery[parsedQuery.type], $options: 'i' },
            isDeleted: false,
        });

        if (user) throw new AppException(checkErrors[parsedQuery.type], HttpStatus.CONFLICT);

        return defaultSuccessResponse;
    };

    status = async ({ initiator, status }: UserStatusDTO & { initiator: UserDocument }) => {
        const trimmedStatus = status.trim();

        if (initiator.status === trimmedStatus) return defaultSuccessResponse;

        await initiator.updateOne({ status: trimmedStatus.length ? trimmedStatus : undefined });

        return defaultSuccessResponse
    };

    name = async ({ initiator, name }: UserNameDto & { initiator: UserDocument }) => {
        await initiator.updateOne({ name });

        return defaultSuccessResponse;
    };

    changeAvatar = async ({ initiator, file }: { initiator: UserDocument; file: Express.Multer.File }) => {
        const key = `users/${initiator._id.toString()}/avatars/${process.env.NODE_ENV === 'dev'  ? Date.now() : crypto.randomUUID()}`;
        const url = `${process.env.BUCKET_PUBLIC_ENDPOINT}/${key}`

        await this.s3.send(new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read'
        }));

        const newFile = await this.fileService.create({ key, url, mimetype: file.mimetype, size: file.size });

        await Promise.all([
            initiator.avatar && this.fileService.deleteMany({ _id: initiator.avatar }), // anyways we store old avatar in storage but delete it from db just in case if we want keep old avatar we should keep it in db
            initiator.updateOne({ avatar: newFile._id }),
        ]);

        return { _id: newFile._id.toString(), url }
    }

    getRecipient = async (recipientId: string | Types.ObjectId) => {
        const recipient = (await this.aggregate([
            { $match: { _id: typeof recipientId === 'string' ? new Types.ObjectId(recipientId) : recipientId } },
            { $lookup: { from: 'files', localField: 'avatar', foreignField: '_id', as: 'avatar', pipeline: [{ $project: { url: 1 } }] } },
            { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
            { $project: recipientProjection },
        ]))[0];

        if (!recipient) throw new AppException({ message: 'Recipient not found' }, HttpStatus.NOT_FOUND);

        return recipient;
    }
}