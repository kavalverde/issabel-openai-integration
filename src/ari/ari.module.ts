import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AriService } from './ari.service';
import { AriController } from './ari.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AriController],
  providers: [AriService],
  exports: [AriService],
})
export class AriModule {}