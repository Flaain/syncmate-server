import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Group } from './schemas/group.schema';
import { Model } from 'mongoose';
import { UserService } from '../user/user.service';
import { AppException } from 'src/utils/exceptions/app.exception';
import { loginExistError } from '../auth/constants';
import { CreateGroupDTO } from './dtos/create.group.dto';
import { UserDocument } from '../user/types';
import { ParticipantService } from '../participant/participant.service';
import { GroupDocument, GroupView } from './types';
import { BaseService } from 'src/utils/services/base/base.service';
import { InviteService } from '../invite/invite.service';

@Injectable()
export class GroupService extends BaseService<GroupDocument, Group> {
    constructor(
        @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
        private readonly userService: UserService,
        private readonly participantService: ParticipantService,
        private readonly inviteService: InviteService,
    ) {
        super(groupModel);
    }

    createGroup = async ({
        login,
        name,
        initiator,
        participants: dtoParticipants,
    }: CreateGroupDTO & { initiator: UserDocument }) => {
        if ((await this.exists({ login })) || (await this.userService.exists({ login }))) {
            throw new AppException(loginExistError, HttpStatus.CONFLICT);
        }

        const findedUsers = await this.userService.find({
            filter: {
                _id: { $in: dtoParticipants, $ne: initiator._id },
                isDeleted: false,
                isPrivate: false,
            },
            projection: { _id: 1 },
        });

        const group = await this.create({ login, name, owner: initiator._id });
        
        const participants = await this.participantService.insertMany([initiator, ...findedUsers].map((user) => ({ 
            user: user._id, 
            group: group._id 
        })));

        await group.updateOne({ participants: participants.map((participant) => participant._id), owner: participants[0]._id });

        return { _id: group._id.toString() };
    };

    getGroup = async ({
        initiator,
        groupId,
        invite,
    }: {
        initiator: UserDocument;
        groupId: string;
        invite?: string;
    }) => {
        const group = await this.findById(groupId, { projection: { invites: 0 } });

        if (!group) throw new AppException({ message: 'Group not found' }, HttpStatus.NOT_FOUND);

        const participant = await this.participantService.findOne({ filter: { userId: initiator._id, groupId: group._id } });

        if (participant) {
            const populatedGroup = await group.populate({
                path: 'participants',
                model: 'Participant',
                populate: {
                    path: 'user',
                    model: 'User',
                    select: { login: 1, name: 1 },
                },
                match: { _id: { $ne: participant._id } },
            });

            return { ...populatedGroup.toObject(), displayAs: GroupView.PARTICIPANT };
        }

        if (group.isPrivate) {
            const isInviteExist = invite ? await this.inviteService.exists({ code: invite, groupId: group._id }) : false;
            const { _id, isOfficial, name, login } = group.toObject();

            if (!isInviteExist) throw new AppException({ message: 'Group not found' }, HttpStatus.NOT_FOUND);

            return {
                _id,
                login,
                name,
                isOfficial,
                displayAs: GroupView.JOIN,
            };
        } else {
            const populatedGroup = await group.populate({
                path: 'participants',
                model: 'Participant',
                populate: {
                    path: 'user',
                    model: 'User',
                    select: { login: 1, name: 1 },
                },
            });

            return { ...populatedGroup.toObject(), displayAs: GroupView.GUEST };
        }
    };
}