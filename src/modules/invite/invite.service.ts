import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/utils/services/base/base.service';
import { InviteDocument } from './types';
import { Invite } from './schema/invite.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class InviteService extends BaseService<InviteDocument, Invite> {
    constructor(@InjectModel(Invite.name) private readonly inviteModel: Model<InviteDocument>) {
        super(inviteModel);
    }
}
