import { Injectable } from '@nestjs/common';

@Injectable()
export class DatesService {
    static oneWeekFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    static oneMonthFromNow = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    static fifteenMinutesFromNow = () => new Date(Date.now() + 1000 * 60 * 15);
    static twoMinutesFromNow = () => new Date(Date.now() + 1000 * 60 * 2);
}