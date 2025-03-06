import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenaiService } from './openai.service';
import { OpenaiController } from './openai.controller';

@Module({
  imports: [ConfigModule],
  controllers: [OpenaiController],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}