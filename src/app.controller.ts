import { Controller, Get } from '@nestjs/common';
import { Public } from './utils/decorators/public.decorator';

@Controller()
export class AppController {
    @Get('/health')
    @Public()
    healthCheck() {
        return { status: true };
    }
}