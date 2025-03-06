import { Module } from '@nestjs/common';
import { AriModule } from '../ari/ari.module';
import { OpenaiModule } from '../openai/openai.module';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';

@Module({
  imports: [AriModule, OpenaiModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}