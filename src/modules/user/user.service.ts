import { z } from 'zod';
import { User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { userCheckSchema } from './schemas/user.check.schema';
import { AppException } from 'src/utils/exceptions/app.exception';
import { emailExistError, loginExistError } from '../auth/constants';
import { IUserService, UserDocument, UserSearchParams } from './types';
import { Model, isValidObjectId } from 'mongoose';
import { IAppException, Providers } from 'src/utils/types';
import { UserStatusDTO } from './dtos/user.status.dto';
import { UserNameDto } from './dtos/user.name.dto';
import { BaseService } from 'src/utils/services/base/base.service';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileService } from '../file/file.service';

@Injectable()
export class UserService extends BaseService<UserDocument, User> implements IUserService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>, 
        @Inject(Providers.S3_CLIENT) private readonly s3: S3Client,
        private readonly fileService: FileService
    ) {
        super(userModel);
    }

    block = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        if (!isValidObjectId(recipientId) || initiator._id.toString() === recipientId || initiator.blockList.some((id) => id.toString() === recipientId)) {
            throw new AppException({ message: 'Cannot block user' }, HttpStatus.BAD_REQUEST);
        }

        const recipient = await this.findById(recipientId);

        if (!recipient) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);

        await this.updateOne({ filter: { _id: initiator._id }, update: { $addToSet: { blockList: recipient._id } } });

        return { recipientId: recipient._id.toString() };
    }

    unblock = async ({ initiator, recipientId }: { initiator: UserDocument; recipientId: string }) => {
        if (!isValidObjectId(recipientId) || initiator._id.toString() === recipientId || !initiator.blockList.some((id) => id.toString() === recipientId)) {
            throw new AppException({ message: 'Cannot unblock user' }, HttpStatus.BAD_REQUEST);
        }

        const recipient = await this.findById(recipientId);

        if (!recipient) throw new AppException({ message: 'User not found' }, HttpStatus.NOT_FOUND);

        await this.updateOne({ filter: { _id: initiator._id }, update: { $pull: { blockList: recipient._id } } });

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

        const errors: Record<typeof parsedQuery.type, Pick<IAppException, 'message' | 'errors'>> = {
            email: emailExistError,
            login: loginExistError,
        };

        const user = await this.exists({
            [parsedQuery.type]: { $regex: parsedQuery[parsedQuery.type], $options: 'i' },
            isDeleted: false,
        });

        if (user) throw new AppException(errors[parsedQuery.type], HttpStatus.CONFLICT);

        return { status: HttpStatus.OK, message: 'OK' };
    };

    status = async ({ initiator, status }: UserStatusDTO & { initiator: UserDocument }) => {
        const trimmedStatus = status.trim();

        if (initiator.status === trimmedStatus) return { status: HttpStatus.OK, message: 'OK' };

        await initiator.updateOne({ status: trimmedStatus.length ? trimmedStatus : undefined });

        return { status: HttpStatus.OK, message: 'OK' };
    };

    name = async ({ initiator, name }: UserNameDto & { initiator: UserDocument }) => {
        await initiator.updateOne({ name });

        return { status: HttpStatus.OK, message: 'OK' };
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
}