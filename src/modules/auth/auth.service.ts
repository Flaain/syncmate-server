import { z } from 'zod';
import { Connection, Types } from 'mongoose';
import { HttpStatus, Injectable } from '@nestjs/common';
import { WithUserAgent } from './types';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JWT_KEYS } from 'src/utils/types';
import { AppException } from 'src/utils/exceptions/app.exception';
import { BcryptService } from 'src/utils/services/bcrypt/bcrypt.service';
import { incorrectPasswordError, otpError } from './constants';
import { SigninDTO } from './dtos/auth.signin.dto';
import { SignupDTO } from './dtos/auth.signup.dto';
import { UserService } from '../user/user.service';
import { OtpService } from '../otp/otp.service';
import { SessionService } from '../session/session.service';
import { OtpType } from '../otp/types';
import { UserDocument } from '../user/types';
import { SessionDocument } from '../session/types';
import { AuthResetDTO } from './dtos/auth.reset.dto';
import { authChangePasswordSchema } from './schemas/auth.change.password.schema';
import { defaultSuccessResponse } from 'src/utils/constants';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class AuthService {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly otpService: OtpService,
        private readonly sessionService: SessionService,
        private readonly bcryptService: BcryptService,
    ) {}
    
    private signAuthTokens = ({ sessionId, userId }: { sessionId: string; userId: string }) => {
        const refreshToken = this.jwtService.sign({ sessionId }, { 
            secret: this.configService.get<string>(JWT_KEYS.REFRESH_TOKEN_SECRET),
            expiresIn: this.configService.get<string>(JWT_KEYS.REFRESH_TOKEN_EXPIRESIN),
        });

        const accessToken = this.jwtService.sign({ userId, sessionId });

        return { accessToken, refreshToken };
    }

    signin = async ({ login, password, userAgent, userIP }: WithUserAgent<SigninDTO>) => {
        const user = (await this.userService.aggregate([
            { $match: { isDeleted: false, $or: [{ email: login }, { login }] } },
            { $lookup: { from: 'files', localField: 'avatar', foreignField: '_id', as: 'avatar', pipeline: [{ $project: { url: 1 } }] } },
            { $unwind: { path: '$avatar', preserveNullAndEmptyArrays: true } },
        ]))[0];

        if (!user || !(await this.bcryptService.compareAsync(password, user.password))) {
            throw new AppException({ message: 'Invalid credentials' }, HttpStatus.UNAUTHORIZED);
        }

        const session = await this.sessionService.create({ userId: user._id, userAgent, userIP });
        const { password: _, ...restUser } = user;

        return { user: restUser, ...this.signAuthTokens({ sessionId: session._id.toString(), userId: user._id.toString() }) };
    }

    signup = async ({ password, otp, userAgent, userIP, ...dto }: WithUserAgent<Required<SignupDTO>>) => {     
        const session = await this.connection.startSession();
        
        session.startTransaction();
        
        try {
            if (await this.userService.findOne({ filter: { $or: [{ email: dto.email }, { login: dto.login }] }, options: { session } })) {
                throw new AppException({ message: 'An error occurred during the registration process. Please try again.' }, HttpStatus.BAD_REQUEST);
            }
    
            if (!await this.otpService.findOneAndDelete({ otp, email: dto.email, type: OtpType.EMAIL_VERIFICATION }, { session })) {
                throw new AppException(otpError, HttpStatus.BAD_REQUEST);
            }
    
            const hashedPassword = await this.bcryptService.hashAsync(password);
            const { password: _, ...restUser } = (await this.userService.create([{ ...dto, password: hashedPassword }], { session }))[0].toObject();
            const s = await this.sessionService.create({ userId: restUser._id, userAgent, userIP });
            
            await session.commitTransaction();

            return { user: restUser, ...this.signAuthTokens({ sessionId: s._id.toString(), userId: restUser._id.toString() }) };
        } catch (error) {
            await session.abortTransaction();

            throw error;
        } finally {
            await session.endSession();
        }
    };

    refresh = async (session: SessionDocument) => ({
        accessToken: this.jwtService.sign({ 
            userId: session.userId.toString(), 
            sessionId: session._id.toString() 
        }),
    });

    reset = async ({ email, otp, password }: AuthResetDTO) => {
        const session = await this.connection.startSession();

        session.startTransaction();

        try {
            if (!await this.otpService.findOneAndDelete({ otp, email, type: OtpType.PASSWORD_RESET }, { session })) {
                throw new AppException({ 
                    message: 'An error occurred during the password reset process. Please try again.',
                    errors: [{ message: 'Invalid OTP code', path: 'otp' }]
                 }, HttpStatus.BAD_REQUEST);
            }
    
            const user = await this.userService.findOne({ filter: { email, isDeleted: false }, options: { session } });
    
            if (!user) throw new AppException({ message: 'Something went wrong' }, HttpStatus.INTERNAL_SERVER_ERROR);
    
            const hashedPassword = await this.bcryptService.hashAsync(password);
    
            await this.sessionService.deleteMany({ userId: user._id }, { session }); 
            await user.updateOne({ password: hashedPassword }, { session });
            
            await session.commitTransaction();

            return defaultSuccessResponse;
        } catch (error) {
            await session.abortTransaction();

            throw error;
        } finally {
            await session.endSession();
        }
    }

    changePassword = async ({ initiator, ...dto }: z.infer<typeof authChangePasswordSchema> & { initiator: UserDocument }) => {
        const parsedQuery = authChangePasswordSchema.parse(dto);

        if (!await this.bcryptService.compareAsync(dto.currentPassword, initiator.password)) {
            throw new AppException(incorrectPasswordError, HttpStatus.CONFLICT);
        }

        if (parsedQuery.type === 'set') {
            const hashedPassword = await this.bcryptService.hashAsync(dto.newPassword);
            const session = await this.connection.startSession();

            session.startTransaction();

            try {
                await initiator.updateOne({ password: hashedPassword }, { session });
                await this.sessionService.deleteMany({ userId: initiator._id }, { session });
                
                await session.commitTransaction();
            } catch (error) {
                await session.abortTransaction();

                throw error;
            } finally {
                await session.endSession();
            }
        }

        return defaultSuccessResponse;
    }

    logout = async ({ user, sessionId }: { user: UserDocument; sessionId: string }) => {
        const session = await this.sessionService.findOne({ filter: { _id: sessionId, userId: user._id } });

        if (!session) throw new AppException({ message: "Cannot find session" }, HttpStatus.UNAUTHORIZED);

        await session.deleteOne()

        return defaultSuccessResponse;
    }

    validate = async (_id: Types.ObjectId | string) => {
        const candidate = await this.userService.findOne({
            filter: { _id, isDeleted: false },
            options: { populate: { path: 'avatar', model: 'File', select: 'url' } },
        });

        if (!candidate) throw new AppException({ message: "Unauthorized" }, HttpStatus.UNAUTHORIZED);

        return candidate;
    };

    verifyToken = <T extends object = Record<string, any>>(token: string, type: 'access' | 'refresh') => {
        try {
            const data = this.jwtService.verify<T>(token, {
                secret: this.configService.get(type === 'access' ? JWT_KEYS.ACCESS_TOKEN_SECRET : JWT_KEYS.REFRESH_TOKEN_SECRET),
            })
    
            return data;
        } catch (error) {
            console.log(error);
            const isTokenExpiredError = error instanceof TokenExpiredError;
            throw new AppException({ 
                message: isTokenExpiredError ? error.message : 'Error appearce while trying to verify token' 
            }, isTokenExpiredError ? HttpStatus.UNAUTHORIZED : HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    profile = async (user: UserDocument) => {
        const { password, ...rest } = user.toObject();

        return { ...rest };
    };
}