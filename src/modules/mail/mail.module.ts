import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
    imports: [
        MailerModule.forRootAsync({
            useFactory: () => ({
                transport: {
                    host: process.env.MAILER_HOST,
                    secure: true,
                    port: 465,
                    auth: {
                        user: process.env.MAILER_USER,
                        pass: process.env.MAILER_PASS
                    },
                },
            }),
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule {}