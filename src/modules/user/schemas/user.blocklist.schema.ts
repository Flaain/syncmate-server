import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class BlockList {
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: { unique: true } })
    user: mongoose.Types.ObjectId;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] })
    blockList: Array<mongoose.Types.ObjectId>;
}

export const BlockListSchema = SchemaFactory.createForClass(BlockList);