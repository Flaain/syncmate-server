import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AllExceptionFilter } from './utils/filters/all.expection.filter';
import { cookieParser } from './utils/middlewares/cookieParser';
import { CookiesService } from './utils/services/cookies/cookies.service';

(async () => {
    try {
        process.on('uncaughtException', (err) => {
            console.error('🔥 Uncaught Exception:', err);
        });
        
        process.on('unhandledRejection', (reason) => {
            console.error('🔥 Unhandled Rejection:', reason);
        });

        const PORT = process.env.PORT ?? 3000;

        const app = await NestFactory.create<NestExpressApplication>(AppModule, {
            cors: {
                origin: Array.isArray(process.env.CLIENT_URL) ? process.env.CLIENT_URL.split(' ') : process.env.CLIENT_URL,
                credentials: true,
            },
        });

        app.use(cookieParser);

        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new AllExceptionFilter(app.get(HttpAdapterHost), app.get(CookiesService)));

        app.use('/health', (_, res: Response) => {
            res.json({ status: true });
        });

        await app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    } catch (error) {
        console.log(error);
    }
})();