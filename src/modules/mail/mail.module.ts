import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
    imports: [
        MailerModule.forRootAsync({
            useFactory: () => ({
                transport: {
                    host: process.env.MAILER_HOST,
                    secure: false,
                    port: 587,
                    tls: { ciphers: 'SSLv3' },
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