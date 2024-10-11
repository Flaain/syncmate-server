import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FEED_TYPE, IFeed } from '../types';

@Schema({ timestamps: true })
export class Feed implements Omit<IFeed, '_id'> {
    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId }], ref: 'User', required: true })
    users: Array<mongoose.Types.ObjectId>;

    @Prop({ type: mongoose.Schema.Types.ObjectId, refPath: 'type', required: true })
    item: mongoose.Types.ObjectId;

    @Prop({ type: Date, required: true })
    lastActionAt: Date;

    @Prop({ type: String, enum: FEED_TYPE, required: true })
    type: FEED_TYPE;

    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
}

export const FeedSchema = SchemaFactory.createForClass(Feed);
