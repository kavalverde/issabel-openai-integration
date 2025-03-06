import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AriService } from './ari.service';

@Controller('ari')
export class AriController {
  constructor(private readonly ariService: AriService) {}

  // Este endpoint podría usarse para probar funcionalidades
  @Get('status')
  getStatus() {
    return {
      status: 'ARI conectado',
      timestamp: new Date().toISOString(),
    };
  }

  // Endpoint para probar la reproducción de audio en un canal
  @Post(':channelId/play')
  async playAudio(
    @Param('channelId') channelId: string,
    @Body() data: { audioFile: string },
  ) {
    await this.ariService.playAudio(channelId, data.audioFile);
    return { success: true, message: `Audio ${data.audioFile} reproducido en canal ${channelId}` };
  }

  // Endpoint para finalizar una llamada
  @Post(':channelId/hangup')
  async hangupCall(@Param('channelId') channelId: string) {
    await this.ariService.hangupCall(channelId);
    return { success: true, message: `Llamada ${channelId} finalizada` };
  }
}