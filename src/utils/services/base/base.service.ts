import { Injectable } from '@nestjs/common';
import { AggregateOptions, Document, FilterQuery, InsertManyOptions, Model, PipelineStage, QueryOptions, Types } from 'mongoose';
import { FindQuery, UpdateQuery } from 'src/utils/types';

@Injectable()
export class BaseService<Doc extends Document, Entity> {
    constructor(private readonly model: Model<Doc>) {}

    create = (body: Omit<Entity, '_id' | 'created'>) => this.model.create(body);
    total = ({ filter, projection, options }: FindQuery<Doc>) => this.model.find(filter, projection, options).countDocuments();
    findOne = ({ filter, projection, options }: FindQuery<Doc>) => this.model.findOne(filter, projection, options);
    insertMany = <T>(array: Array<T>, options?: InsertManyOptions) => this.model.insertMany(array, options);
    findById = (id: Types.ObjectId | string, params?: Omit<FindQuery<Doc>, 'filter'>) => this.model.findById(id, params?.projection, params?.options);
    find = ({ filter, projection, options }: FindQuery<Doc>) => this.model.find(filter, projection, options);
    exists = (filter: FilterQuery<Doc>) => this.model.exists(filter);
    findOneAndDelete = (filter: FilterQuery<Doc>, options: QueryOptions<Doc> = {}) => this.model.findOneAndDelete(filter, options);
    deleteMany = (filter: FilterQuery<Doc>) => this.model.deleteMany(filter);
    updateOne = ({ filter, update, options }: UpdateQuery<Doc, any>) => this.model.updateOne(filter, update, options);
    updateMany = ({ filter, update, options }: UpdateQuery<Doc, any>) => this.model.updateMany(filter, update, options); // any for now cuz i can't find UpdateOptions interface
    findOneAndUpdate = ({ filter, update, options }: UpdateQuery<Doc>) => this.model.findOneAndUpdate(filter, update, options);
    aggregate = (pipeline: Array<PipelineStage>, options?: AggregateOptions) => this.model.aggregate(pipeline, options);
}