import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Invite, InviteSchema } from './schema/invite.schema';

@Module({
    imports: [MongooseModule.forFeature([{ name: Invite.name, schema: InviteSchema }])],
    providers: [InviteService],
    controllers: [InviteController],
    exports: [InviteService],
})
export class InviteModule {}