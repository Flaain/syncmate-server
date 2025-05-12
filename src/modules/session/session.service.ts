import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from 'src/utils/exceptions/app.exception';
import { BaseService } from 'src/utils/services/base/base.service';
import { AppExceptionCode, Providers } from 'src/utils/types';
import { UAParser } from 'ua-parser-js';
import { Session } from './schemas/session.schema';
import { DropSessionParams, SessionDocument } from './types';

@Injectable()
export class SessionService extends BaseService<SessionDocument, Session> {
    constructor(
        @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
        @Inject(Providers.UA_PARSER) private readonly uaParser: UAParser,
    ) {
        super(sessionModel);
    }

    validate = async (_id: Types.ObjectId | string) => {
        const session = await this.findById(_id);

        if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
            throw new AppException(
                {
                    message: 'Session expired',
                    errorCode: AppExceptionCode.REFRESH_DENIED,
                },
                HttpStatus.UNAUTHORIZED,
            );
        }

        return session;
    };

    getSessions = async ({ userId, sessionId }: { userId: Types.ObjectId | string; sessionId: string }) => {
        const sessions = await this.find({ filter: { userId }, projection: { userId: 0 } });
        const result = { currentSession: null, sessions: [] };

        for (let i = 0; i < sessions.length; i += 1) {
            const session = sessions[i], _id = session._id.toString();
            
            const data = {
                _id,
                userAgent: this.uaParser.setUA(session.userAgent).getResult(),
                createdAt: session.createdAt,
                expiresAt: session.expiresAt,
            };

            _id === sessionId ? (result.currentSession = data) : result.sessions.push(data);
        }

        result.sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        return result;
    };

    getSessionsSize = async (initiatorId: Types.ObjectId) => this.countDocuments({ userId: initiatorId, expiresAt: { $gt: Date.now() } });

    dropSession = async ({ initiatorUserId, initiatorSessionId, sessionId }: DropSessionParams) => {
        const session = await this.findOneAndDelete({
            userId: initiatorUserId,
            $and: [{ _id: sessionId }, { _id: { $ne: initiatorSessionId } }],
        });

        if (!session) throw new AppException({ message: 'Failed to drop session' }, HttpStatus.BAD_REQUEST);

        return { _id: session._id.toString() };
    };

    terminateAllSessions = async ({ initiatorUserId, initiatorSessionId }: Omit<DropSessionParams, 'sessionId'>) => {
        return this.deleteMany({ userId: initiatorUserId, _id: { $ne: initiatorSessionId } });
    };
}