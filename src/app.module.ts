import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { FeedModule } from './modules/feed/feed.module';
import { FileModule } from './modules/file/file.module';
import { MessageModule } from './modules/message/message.module';
import { OtpModule } from './modules/otp/otp.module';
import { SessionModule } from './modules/session/session.module';
import { UserModule } from './modules/user/user.module';
import { BucketModule } from './utils/services/bucket/bucket.module';
import { UAParserModule } from './utils/services/uaparser/uaparser.module';
import { cookieParser } from './utils/middlewares/cookieParser';
import { RequestMiddleware } from './utils/middlewares/request.middleware';
import { GatewayModule } from './modules/gateway/gateway.module';
import { GlobalExceptionFilter } from './utils/filters/global.exception.filter';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, expandVariables: true, cache: true }),
        AuthModule,
        SessionModule,
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
        MongooseModule.forRoot(process.env.DATABASE_URI),
        ThrottlerModule.forRoot([{ limit: 10, ttl: 60000 }]),
        EventEmitterModule.forRoot({ global: true }),
        ConversationModule,
        FileModule,
        MessageModule,
        OtpModule,
        GatewayModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(cookieParser, RequestMiddleware).forRoutes('*');
    }
}