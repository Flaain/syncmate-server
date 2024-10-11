import UAParser from 'ua-parser-js';
import { Model, Types } from 'mongoose';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Session } from './schemas/session.schema';
import { AppException } from 'src/utils/exceptions/app.exception';
import { AppExceptionCode, Providers } from 'src/utils/types';
import { DropSessionParams, SessionDocument } from './types';
import { BaseService } from 'src/utils/services/base/base.service';

@Injectable()
export class SessionService extends BaseService<SessionDocument, Session> {
    constructor(
        @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
        @Inject(Providers.PARSER_CLIENT) private readonly UAParser: UAParser,
    ) {
        super(sessionModel);
    }

    validate = async (_id: Types.ObjectId | string) => {
        const session = await this.findById(_id);

        if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
            throw new AppException({ 
                message: 'Session expired',
                errorCode: AppExceptionCode.REFRESH_DENIED,
            }, HttpStatus.UNAUTHORIZED);
        }

        return session;
    };

    getSessions = async ({ userId, sessionId }: { userId: Types.ObjectId | string; sessionId: string }) => {
        const sessions = await this.find({ filter: { userId }, projection: { userId: 0 } }).lean();
        const currentSession = sessions.find(({ _id }) => _id.toString() === sessionId);

        if (!currentSession) {
            throw new AppException({ 
                message: 'Session expired',
                errorCode: AppExceptionCode.EXPIRED_ACCESS_TOKEN,
            }, HttpStatus.UNAUTHORIZED);
        }

        return {
            currentSession: {
                ...currentSession,
                userAgent: this.UAParser.setUA(currentSession.userAgent).getResult()
            },
            sessions: sessions.filter(({ _id }) => _id.toString() !== sessionId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((session) => ({ 
                ...session,
                userAgent: this.UAParser.setUA(session.userAgent).getResult(), 
            })),
        };
    };

    dropSession = async ({ initiatorUserId, initiatorSessionId, sessionId }: DropSessionParams) => {
        const session = await this.findOneAndDelete({ 
            userId: initiatorUserId,
            $and: [{ _id: sessionId }, { _id: { $ne: initiatorSessionId } }]
        });

        if (!session) throw new AppException({ message: 'Failed to drop session' }, HttpStatus.BAD_REQUEST);

        return { _id: session._id.toString() };
    }

    terminateAllSessions = async ({ initiatorUserId, initiatorSessionId }: Omit<DropSessionParams, 'sessionId'>) => {
        return this.deleteMany({ userId: initiatorUserId, _id: { $ne: initiatorSessionId } });
    }
}