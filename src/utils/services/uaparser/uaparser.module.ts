import { DynamicModule, Module, Provider } from '@nestjs/common';
import { Providers } from 'src/utils/types';
import { UAParser } from 'ua-parser-js';

@Module({})
export class UAParserModule {
    public static forRoot(): DynamicModule {
        const ua = new UAParser();

        const uaProvider: Provider = {
            provide: Providers.UA_PARSER,
            useValue: ua,
        };

        return {
            global: true,
            module: UAParserModule,
            providers: [uaProvider],
            exports: [uaProvider],
        };
    }
}