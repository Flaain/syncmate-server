import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { MongoError, MongoErrorLabel } from 'mongodb';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { defaultSuccessResponse, recipientProjection } from 'src/utils/constants';
import { AppException } from 'src/utils/exceptions/app.exception';
import { getSearchPipeline } from 'src/utils/helpers/getSearchPipeline';
import { BaseService } from 'src/utils/services/base/base.service';
import { Providers } from 'src/utils/types';
import { z } from 'zod';
import { FileService } from '../file/file.service';
import { checkErrors } from './constants';
import { BlockList } from './schemas/user.blocklist.schema';
import { userCheckSchema } from './schemas/user.check.schema';
import { User } from './schemas/user.schema';
import { UserDocument, UserSearchParams } from './types';
import { UserEditDTO } from './dtos/user.edit.dto';

@Injectable()
export class UserService extends BaseService<UserDocument, User> {
    constructor(
        @InjectConnection() private readonly connection: Connection,
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
        const users = (await this.aggregate(getSearchPipeline({
            limit,
            page,
            pipeline: [
                {
                    $match: {
                        _id: { $ne: initiatorId },
                        $or: [{ name: { $regex: query, $options: 'i' } }, { login: { $regex: query, $options: 'i' } }],
                        isPrivate: false,
                        isDeleted: false,
                    },
                },
                { $lookup: { from: 'files', localField: 'avatar', foreignField: '_id', as: 'avatar' } },
                { $project: { _id: 1, name: 1, login: 1, isOfficial: 1 } }
            ]
        })))[0];

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

    edit = async (dto: UserEditDTO, initiator: UserDocument) => {
        const updates = { $set: {}, $unset: {} };

        for (const key in dto) {
            if (dto.hasOwnProperty(key)) {
                const trimmedValue = dto[key].trim();

                trimmedValue.length ? (updates.$set[key] = trimmedValue) : (updates.$unset[key] = '')
            }
        }

        const data = await this.findOneAndUpdate({ 
            filter: { _id: initiator._id }, 
            options: { returnDocument: 'after', projection: Object.keys(dto).join(' ') },
            update: updates
        });

        return { ...updates.$unset, ...data.toObject() };
    }

    changeAvatar = async (dto: { initiator: UserDocument; file: Express.Multer.File }) => {
        const { file, initiator } = dto;

        const key = `users/${initiator._id.toString()}/avatars/${process.env.NODE_ENV === 'dev' ? Date.now() : crypto.randomUUID()}`;
        const url = `${process.env.BUCKET_PUBLIC_ENDPOINT}/${key}`

        await this.s3.send(new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read'
        }));

        const session = await this.connection.startSession();

        session.startTransaction();

        try {
            const newFile = (await this.fileService.create([{ key, url, mimetype: file.mimetype, size: file.size }], { session }))[0];

            initiator.avatar && await this.fileService.deleteMany({ _id: initiator.avatar }); // we store old avatar in storage but delete it from db just in case if we want keep old avatar we should keep it in db
            
            await initiator.updateOne({ avatar: newFile._id });
            
            await BaseService.commitWithRetry(session);

            return { _id: newFile._id.toString(), url }
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();
                
                return this.changeAvatar(dto);
            } else {
                !session.transaction.isCommitted && await session.abortTransaction();

                throw error;
            }
        } finally {
            session.endSession();
        }
    }

    toRecipient = (user: UserDocument) => ({
        _id: user._id.toString(),
        avatar: user.avatar,
        name: user.name,
        login: user.login,
        presence: user.presence,
        isOfficial: user.isOfficial,
    })

    getRecipient = async (recipientId: string | Types.ObjectId, session?: ClientSession) => {
        const recipient = (
            await this.aggregate(
                [
                    {
                        $match: {
                            _id: typeof recipientId === 'string' ? new Types.ObjectId(recipientId) : recipientId,
                        },
                    },
                    {
                        $lookup: {
                            from: 'files',
                            localField: 'avatar',
                            foreignField: '_id',
                            as: 'avatar',
                            pipeline: [{ $project: { url: 1 } }],
                        },
                    },
                    { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
                    { $project: recipientProjection },
                ],
            )
        )[0];

        if (!recipient) throw new AppException({ message: 'Recipient not found' }, HttpStatus.NOT_FOUND);

        return recipient;
    }
}