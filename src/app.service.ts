import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      name: 'Issabel-OpenAI Integration',
      version: '0.1.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }
}