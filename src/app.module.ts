import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { MessageModule } from './modules/message/message.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { ParticipantModule } from './modules/participant/participant.module';
import { GroupModule } from './modules/group/group.module';
import { SessionModule } from './modules/session/session.module';
import { OtpModule } from './modules/otp/otp.module';
import { FeedModule } from './modules/feed/feed.module';
import { UAParserModule } from './utils/services/uaparser/uaparser.module';
import { BucketModule } from './utils/services/bucket/bucket.module';
import { APP_GUARD } from '@nestjs/core';
import { FileModule } from './modules/file/file.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
        AuthModule,
        UserModule,
        FeedModule,
        UAParserModule.forRoot(),
        BucketModule.forRoot({
            region: process.env.STORAGE_REGION,
            endpoint: process.env.STORAGE_ENDPOINT,
            credentials: {
                accessKeyId: process.env.BUCKET_KEY_ID,
                secretAccessKey: process.env.BUCKET_SECRET,
            },
        }),
        MongooseModule.forRoot(process.env.DATABASE_URI, { retryWrites: true }),
        ThrottlerModule.forRoot([{ limit: 10, ttl: 60000 }]),
        EventEmitterModule.forRoot({ global: true }),
        ConversationModule,
        FileModule,
        MessageModule,
        GatewayModule,
        ParticipantModule,
        GroupModule,
        SessionModule,
        OtpModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}