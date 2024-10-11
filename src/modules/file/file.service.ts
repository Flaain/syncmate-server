import { Inject, Injectable } from '@nestjs/common';
import { FileDocument } from './types';
import { BaseService } from 'src/utils/services/base/base.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Providers } from 'src/utils/types';
import { S3Client } from '@aws-sdk/client-s3';
import { File } from './schemas/file.schema';

@Injectable()
export class FileService extends BaseService<FileDocument, File> {
    constructor(
        @InjectModel(File.name) private readonly fileModel: Model<FileDocument>,
        @Inject(Providers.S3_CLIENT) private readonly s3: S3Client,
    ) {
        super(fileModel);
    }
}
