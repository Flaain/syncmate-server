import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionFilter } from './utils/filters/all.expection.filter';
import { CookiesService } from './utils/services/cookies/cookies.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Response } from 'express';
import { cookieParser } from './utils/middlewares/cookieParser';

(async () => {
    try {
        const PORT = 3000;

        const app = await NestFactory.create<NestExpressApplication>(AppModule, { 
            cors: { 
                origin: ['http://localhost:4173', 'http://localhost:5173'], 
                credentials: true
            } 
        });

        app.use(cookieParser); // <-- right now for my needs i can use my custom parser without lib

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