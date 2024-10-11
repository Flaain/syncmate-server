import { DynamicModule, Module, Provider } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import { UAParserService } from './uaparser.service';
import { Providers } from 'src/utils/types';

@Module({})
export class UAParserModule {
    public static forRoot(ua?: string, extensions?: Record<string, unknown>): DynamicModule {
        const parser = new UAParser(ua, extensions);

        const parserProvider: Provider = {
            provide: Providers.PARSER_CLIENT,
            useValue: parser,
        };

        return {
            global: true,
            module: UAParserModule,
            providers: [parserProvider, UAParserService],
            exports: [parserProvider, UAParserService],
        };
    }
}