import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GatewayAdapter } from './modules/gateway/gateway.adapter';

(async () => {
    try {
        const PORT = process.env.PORT ?? 3000;

        const app = await NestFactory.create<NestExpressApplication>(AppModule, {
            cors: {
                origin: process.env.CLIENT_URL.split(' '),
                credentials: true,
            },
        });

        app.useWebSocketAdapter(new GatewayAdapter(app));
        
        app.enableShutdownHooks();

        const gracefulShutdown = async (signal: string) => {
            try {
                console.log(`🛑 Received ${signal}, starting graceful shutdown...`);
                await app.close();
                console.log('✅ Application closed gracefully');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during graceful shutdown', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        process.on('uncaughtException', (err) => {
            console.error('💥 Uncaught Exception', err);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });

        await app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    } catch (error) {
        console.log(error);
    }
})();