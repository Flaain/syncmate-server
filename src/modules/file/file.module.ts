import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { MongooseModule } from '@nestjs/mongoose';
import { File, FileSchema } from './schemas/file.schema';

@Module({
    imports: [MongooseModule.forFeature([{ name: File.name, schema: FileSchema }])],
    providers: [FileService],
    exports: [FileService],
})
export class FileModule {}