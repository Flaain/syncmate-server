import { Test, TestingModule } from '@nestjs/testing';
import { UAParserService } from '../uaparser.service';

describe('UAParserService', () => {
    let service: UAParserService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UAParserService],
        }).compile();

        service = module.get<UAParserService>(UAParserService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});