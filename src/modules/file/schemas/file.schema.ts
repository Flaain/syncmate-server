import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IFile } from '../types';

@Schema({ timestamps: true })
export class File implements Omit<IFile, '_id'> {
    @Prop({ type: String, required: true })
    key: string;

    @Prop({ type: String, required: true })
    mimetype: string;

    @Prop({ type: Number, required: true })
    size: number;

    @Prop({ type: String })
    url?: string;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export const FileSchema = SchemaFactory.createForClass(File);