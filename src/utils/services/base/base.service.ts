import { Injectable } from '@nestjs/common';
import { MongoError, MongoErrorLabel } from 'mongodb';
import {
    AggregateOptions,
    ClientSession,
    Document,
    FilterQuery,
    InsertManyOptions,
    Model,
    MongooseBaseQueryOptions,
    PipelineStage,
    QueryOptions,
    RootFilterQuery,
    Types,
} from 'mongoose';
import { FindQuery, UpdateQuery } from 'src/utils/types';

@Injectable()
export class BaseService<Doc extends Document, Entity> {
    constructor(private readonly model: Model<Doc>) {}

    static commitWithRetry = async (session: ClientSession) => {
        try {
            await session.commitTransaction();
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.UnknownTransactionCommitResult)) {
                await BaseService.commitWithRetry(session);
            } else {
                throw error;
            }
        }
    };

    countDocuments = (filter: RootFilterQuery<Doc>, options?: any) => this.model.countDocuments(filter, options);
    create = (body: Omit<Entity, '_id' | 'created'> | [Omit<Entity, '_id' | 'created'>], options?: any): any => this.model.create(body, options);
    total = ({ filter, projection, options }: FindQuery<Doc>) => this.model.find(filter, projection, options).countDocuments();
    findOne = ({ filter, projection, options }: FindQuery<Doc>) => this.model.findOne(filter, projection, options);
    insertMany = <T>(array: Array<T>, options?: InsertManyOptions) => this.model.insertMany(array, options);
    findById = (id: Types.ObjectId | string, params?: Omit<FindQuery<Doc>, 'filter'>) => this.model.findById(id, params?.projection, params?.options);
    find = ({ filter, projection, options }: FindQuery<Doc>) => this.model.find(filter, projection, options);
    exists = (filter: FilterQuery<Doc>) => this.model.exists(filter);
    findOneAndDelete = (filter: FilterQuery<Doc>, options: QueryOptions<Doc> = {}) => this.model.findOneAndDelete(filter, options);
    deleteMany = (filter: FilterQuery<Doc>, options?: MongooseBaseQueryOptions<Doc> | null) => this.model.deleteMany(filter, options);
    updateOne = ({ filter, update, options }: UpdateQuery<Doc, any>) => this.model.updateOne(filter, update, options);
    updateMany = ({ filter, update, options }: UpdateQuery<Doc, any>) => this.model.updateMany(filter, update, options); // any for now cuz i can't find UpdateOptions interface
    findOneAndUpdate = ({ filter, update, options }: UpdateQuery<Doc>) => this.model.findOneAndUpdate(filter, update, options);
    aggregate = (pipeline: Array<PipelineStage>, options?: AggregateOptions) => this.model.aggregate(pipeline, options);
}