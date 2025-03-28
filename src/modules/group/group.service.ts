import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Group } from './schemas/group.schema';
import { Connection, Model, Types } from 'mongoose';
import { MongoError, MongoErrorLabel } from 'mongodb';
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
import { getGroupPipeline, getParticipantsPipeline } from './utils/pipelines';

@Injectable()
export class GroupService extends BaseService<GroupDocument, Group> {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
        private readonly userService: UserService,
        private readonly participantService: ParticipantService,
        private readonly inviteService: InviteService,
        private readonly feedService: FeedService,
    ) {
        super(groupModel);
    }

    createGroup = async (dto: CreateGroupDTO & { initiator: UserDocument }) => {
        const { initiator, participants: dtoParticipants, name, login } = dto;

        if ((await this.exists({ login })) || (await this.userService.exists({ login }))) {
            throw new AppException(loginExistError, HttpStatus.CONFLICT);
        }

        const session = await this.connection.startSession();

        session.startTransaction();

        try {
            const findedUsers = await this.userService.find({
                filter: {
                    _id: { $in: dtoParticipants, $ne: initiator._id },
                    isDeleted: false,
                    isPrivate: false,
                },
                projection: { _id: 1 },
                options: { session },
            });
    
            const group: any = (await this.create([{ login, name, owner: initiator._id }], { session }))[0];

            const usersIds = [initiator._id, ...findedUsers.map((user) => user._id)];
            
            const participants = await this.participantService.insertMany(
                usersIds.map((_id, index) => ({
                    user: _id,
                    group: group._id,
                    role: !index ? ParticipantRole.OWNER : ParticipantRole.PARTICIPANT,
                })),
                { session },
            );
    
            await this.feedService.create(
                [
                    {
                        item: group._id as Types.ObjectId,
                        type: FEED_TYPE.GROUP,
                        users: usersIds,
                        lastActionAt: new Date(),
                    },
                ],
                { session },
            );

            await group.updateOne(
                {
                    participants: participants.map((participant) => participant._id),
                    owner: participants[0]._id,
                },
                { session },
            );
            
            BaseService.commitWithRetry(session);

            return { _id: group._id.toString() };
        } catch (error) {
            if (error instanceof MongoError && error.hasErrorLabel(MongoErrorLabel.TransientTransactionError)) {
                await session.abortTransaction();
                
                return this.createGroup(dto);
            } else {
                !session.transaction.isCommitted && await session.abortTransaction();

                throw error;
            }
        } finally {
            session.endSession();
        }
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

    getParticipants = async ({ groupId, cursor, initiator }: { groupId: string; cursor: string; initiator: UserDocument }) => {
        const { me, participants } = (await this.aggregate(getParticipantsPipeline(groupId, initiator._id, cursor)))[0];
        
        if (!me) throw new AppException({ message: 'Cannot get participants' }, HttpStatus.BAD_REQUEST);

        return participants;
    }

    getPreviousMessages = async ({ initiator, groupId, cursor }: { initiator: UserDocument; groupId: string; cursor: string }) => {
        const group = (await this.aggregate(getGroupPipeline(groupId, initiator._id, cursor)))[0];

        if (!group || (group.isPrivate && !group.me)) throw new AppException({ message: 'Cannot get previous messages' }, HttpStatus.NOT_FOUND);

        return group.messages;
    }
}