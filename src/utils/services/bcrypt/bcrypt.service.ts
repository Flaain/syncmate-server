import { compare, hash } from 'bcrypt';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BcryptService {
    hashAsync = (value: string, salt: number = 10) => hash(value, salt);
    compareAsync = (value: string, hash: string) => compare(value, hash);
}