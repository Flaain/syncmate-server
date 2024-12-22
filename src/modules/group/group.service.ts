import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Group } from './schemas/group.schema';
import { Model, Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { AppException } from 'src/utils/exceptions/app.exception';
import { loginExistError } from '../auth/constants';
import { CreateGroupDTO } from './dtos/create.group.dto';
import { UserDocument } from '../user/types';
import { ParticipantService } from '../participant/participant.service';
import { GroupDocument, GroupView } from './types';
import { BaseService } from 'src/utils/services/base/base.service';
import { InviteService } from '../invite/invite.service';
import { FeedService } from '../feed/feed.service';
import { FEED_TYPE } from '../feed/types';
import { ParticipantRole } from '../participant/types';
import { getGroupPipeline } from './utils/getGroupPipeline';

@Injectable()
export class GroupService extends BaseService<GroupDocument, Group> {
    constructor(
        @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
        private readonly userService: UserService,
        private readonly participantService: ParticipantService,
        private readonly inviteService: InviteService,
        private readonly feedService: FeedService,
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
        const usersIds = [initiator._id, ...findedUsers.map((user) => user._id)];
        const participants = await this.participantService.insertMany(
            usersIds.map((_id, index) => ({
                user: _id,
                group: group._id,
                role: !index ? ParticipantRole.OWNER : ParticipantRole.PARTICIPANT,
            })),
        );

        await Promise.all([
            this.feedService.create({
                item: group._id as Types.ObjectId,
                type: FEED_TYPE.GROUP,
                users: usersIds,
                lastActionAt: new Date(),
            }),
            group.updateOne({
                participants: participants.map((participant) => participant._id),
                owner: participants[0]._id,
            }),
        ]);

        return { _id: group._id.toString() };
    };

    getGroup = async ({ initiator, groupId, invite }: { initiator: UserDocument; groupId: string; invite?: string }) => {
        const group = (await this.aggregate(getGroupPipeline(groupId, initiator._id)))[0];

        if (!group) throw new AppException({ message: 'Group not found' }, HttpStatus.NOT_FOUND);

        if (group.me) return { ...group, displayAs: GroupView.PARTICIPANT };

        if (group.isPrivate) {
            const isInviteExist = invite ? await this.inviteService.exists({ code: invite, groupId: group._id }) : false;
            const { _id, login, name, avatar } = group;

            return {
                _id,
                login,
                name,
                avatar,
                displayAs: isInviteExist ? GroupView.JOIN : GroupView.REQUEST,
            };
        } else {
            return { ...group, displayAs: GroupView.GUEST };
        }
    };
}