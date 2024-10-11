import { IFile as IFileNestJS } from "@nestjs/common/pipes/file/interfaces";
import { Document, SchemaTimestampsConfig } from "mongoose";

export type FileDocument = IFile & Document & SchemaTimestampsConfig;

export interface IFile extends IFileNestJS {
    _id: string;
    key: string;
    createdAt?: Date;
    updatedAt?: Date;
}