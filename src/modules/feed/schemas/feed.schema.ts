import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { FEED_TYPE } from '../types';

@Schema({ timestamps: true })
export class Feed {
    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId }], ref: 'FeedConfig', required: true })
    configs: Array<mongoose.Types.ObjectId>;
    
    @Prop({ type: mongoose.Schema.Types.ObjectId, refPath: 'type', required: true, index: { unique: true } })
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