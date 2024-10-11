import { DynamicModule, Module, Provider } from '@nestjs/common';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { Providers } from 'src/utils/types';

@Module({})
export class BucketModule {
    public static forRoot(config: S3ClientConfig): DynamicModule {
        const s3 = new S3Client(config);

        const s3Provider: Provider = {
            provide: Providers.S3_CLIENT,
            useValue: s3,
        };

        return {
            global: true,
            module: BucketModule,
            providers: [s3Provider],
            exports: [s3Provider],
        };
    }
}