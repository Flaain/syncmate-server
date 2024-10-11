import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Participant } from './schemas/participant.schema';
import { Model } from 'mongoose';
import { ParticipantDocument } from './types';
import { BaseService } from 'src/utils/services/base/base.service';

@Injectable()
export class ParticipantService extends BaseService<ParticipantDocument, Participant> {
    constructor(@InjectModel(Participant.name) private readonly participantModel: Model<ParticipantDocument>) {
        super(participantModel);
    }
}