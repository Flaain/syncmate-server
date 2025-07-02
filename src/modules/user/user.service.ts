import { z } from 'zod';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { MongoError, MongoErrorLabel } from 'mongodb';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { defaultSuccessResponse } from 'src/utils/constants';
import { AppException } from 'src/utils/exceptions/app.exception';
import { getSearchPipeline } from 'src/utils/helpers/getSearchPipeline';
import { BaseService } from 'src/utils/services/base/base.service';
import { Providers } from 'src/utils/types';
import { FileService } from '../file/file.service';
import { BlockList } from './schemas/user.blocklist.schema';
import { userCheckSchema } from './schemas/user.check.schema';
import { User } from './schemas/user.schema';
import { UserDocument, UserEditDTO, UserPrivacySettingModeDTO, UserSearchParams } from './types';
import { UserSettings } from './schemas/user.settings.schema';
import { UserPrivacySettings } from './schemas/user.privacy.schema';
import { getPrivacySettingsPipeline } from './utils/getPrivacySettingsPipeline';
import { getRecipientPipeline } from './utils/getRecipientPipeline';
import { getInitiatorAsRecipientFieldFactory } from './utils/getInitiatorAsRecipientFieldFactory';

@Injectable()
export class UserService extends BaseService<UserDocument, User> {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(UserSettings.name) public readonly settingsModel: Model<UserSettings>,
        @InjectModel(UserPrivacySettings.name) private readonly privacyModel: Model<UserPrivacySettings>,
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
        console.log(dto);
        const parsedQuery = userCheckSchema.parse(dto);

        if (
            await this.exists({
                [parsedQuery.type]: { $regex: parsedQuery[parsedQuery.type], $options: 'i' },
                isDeleted: false,
            })
        ) {
            throw new AppException(
                {
                    message: 'An account with these details already exists.',
                    errors: [{ message: `${parsedQuery.type} already exists`, path: parsedQuery.type }],
                },
                HttpStatus.CONFLICT,
            );
        }

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
            const newFile = (
                await this.fileService.create(
                    [{ key, originalName: file.originalname, url, mimetype: file.mimetype, size: file.size }],
                    { session },
                )
            )[0];

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

    getRecipient = async (recipientId: string | Types.ObjectId, initiatorId: Types.ObjectId, session?: ClientSession, feed: boolean = false) => {
        const recipient = (await this.aggregate(getRecipientPipeline(recipientId, initiatorId, feed), { session }))[0];

        if (!recipient) throw new AppException({ message: 'Recipient not found' }, HttpStatus.NOT_FOUND);

        return recipient;
    }

    getInitiatorAsRecipient = async (initiator: UserDocument, recipientId: Types.ObjectId, session?: ClientSession) => {
        // TODO: temp solution, find a better way
        const initiatorAsRecipient = (await this.settingsModel.aggregate([
            { $match: { _id: initiator.settings._id } },
            { $lookup: { from: 'privacy_settings', localField: 'privacy_settings', foreignField: '_id', as: 'privacy_settings' } },
            { $unwind: { path: '$privacy_settings', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    ...getInitiatorAsRecipientFieldFactory('presence', recipientId, 'whoCanSeeMyLastSeenTime'),
                    ...getInitiatorAsRecipientFieldFactory('avatar', recipientId, 'whoCanSeeMyProfilePhotos'),
                },
            },
        ], { session }))[0];

        return {
            _id: initiator._id,
            avatar: initiatorAsRecipient.avatar ? initiator.avatar : undefined,
            name: initiator.name,
            login: initiator.login,
            presence: initiatorAsRecipient.presence ? initiator.presence : undefined,
            isOfficial: initiator.isOfficial,
        }
    }

    createUser = async (body: any, options?: any) => { // TODO: fix type
        const privacy_settings = await this.privacyModel.create({});
        const settings_doc = await this.settingsModel.create({ privacy_settings: privacy_settings._id });
        
        const {
            password,
            settings,
            presence,
            __v,
            ...restUser
        } = (
            await this.create([{ ...body, login: body.login.toLowerCase(), settings: settings_doc._id }], {
                session: options?.session,
            })
        )[0].toObject();

        return restUser;
    }

    getPrivacySettings = async (initiator: UserDocument) => {
        const settings = (await this.settingsModel.aggregate(getPrivacySettingsPipeline(initiator.settings._id)))[0];

        if (!settings) throw new AppException({ message: 'Settings not found' }, HttpStatus.NOT_FOUND);

        return settings;
    };

    updatePrivacySettingMode = async ({ initiator, dto: { setting, mode } }: { initiator: UserDocument; dto: UserPrivacySettingModeDTO }) => {
        const settings = await this.settingsModel.findById(initiator.settings._id);

        if (!settings) throw new AppException({ message: 'Settings not found' }, HttpStatus.NOT_FOUND);

        await this.privacyModel.findOneAndUpdate(
            { _id: settings.privacy_settings._id },
            {
                $set: {
                    [`${setting}.mode`]: mode,
                    [`${setting}.${mode ? 'allow' : 'deny'}`]: [], // clear exceptions. If new mode 1 - clear allow, else - clear deny
                },
            },
        );

        return defaultSuccessResponse;
    }
}