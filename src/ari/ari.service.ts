import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AriClient from 'ari-client';
import { AriChannel, AriCallEvent } from './interfaces/ari.interface';
import { Subject } from 'rxjs';

@Injectable()
export class AriService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AriService.name);
  private client: any;
  private connected = false;

  // Observable para emitir eventos de llamadas
  public callEvents = new Subject<AriCallEvent>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.disconnect();
  }

  private async connect() {
    try {
      const ariUrl = this.configService.get<string>('issabel.ariUrl');
      const username = this.configService.get<string>('issabel.username');
      const password = this.configService.get<string>('issabel.password');
      const appName = this.configService.get<string>('issabel.appName');

      this.logger.log(`Conectando a ARI en ${ariUrl}`);

      this.client = await AriClient.connect(ariUrl, username, password, {
        app: appName,
      });

      this.connected = true;
      this.logger.log('Conexión a ARI establecida con éxito');

      // Suscribirse a eventos de Stasis
      this.client.on('StasisStart', (event, channel) => {
        this.logger.log(`Llamada entrante: ${channel.id}`);

        // Emitir evento de llamada entrante
        this.callEvents.next({
          type: 'call_start',
          channel: this.mapChannel(channel),
          timestamp: new Date().toISOString(),
          asterisk_id: event.asterisk_id,
        });

        // Registrar más manejadores para este canal
        this.setupChannelHandlers(channel);
      });

      // Iniciar aplicación Stasis
      this.client.start(appName);
    } catch (error) {
      this.connected = false;
      this.logger.error(`Error al conectar con ARI: ${error.message}`);
      // Reintentar conexión después de un tiempo
      setTimeout(() => this.connect(), 5000);
    }
  }

  private disconnect() {
    if (this.client && this.connected) {
      this.client.close();
      this.connected = false;
      this.logger.log('Desconexión de ARI realizada');
    }
  }

  private setupChannelHandlers(channel) {
    // Manejar fin de llamada
    channel.on('StasisEnd', () => {
      this.logger.log(`Llamada finalizada: ${channel.id}`);

      this.callEvents.next({
        type: 'call_end',
        channel: this.mapChannel(channel),
        timestamp: new Date().toISOString(),
        asterisk_id: '',
      });
    });

    // Puedes agregar más manejadores de eventos aquí
  }

  private mapChannel(channel): AriChannel {
    return {
      id: channel.id,
      name: channel.name,
      state: channel.state,
      caller: {
        name: channel.caller.name,
        number: channel.caller.number,
      },
      connected: {
        name: channel.connected.name,
        number: channel.connected.number,
      },
    };
  }

  // Método para grabar audio de la llamada
  async recordCall(channelId: string, format: string = 'wav'): Promise<string> {
    try {
      const fileName = `call-${channelId}-${Date.now()}.${format}`;
      const destination = `/var/spool/asterisk/monitor/${fileName}`;
      const recording = await this.client.channels.record({
        channelId,
        name: fileName,
        format,
        beep: false,
        maxDurationSeconds: 300, // 5 minutos máximo
        ifExists: 'overwrite',
        destination: destination
      });

      this.logger.log(`Iniciando grabación: ${fileName}`);
      return fileName;
    } catch (error) {
      this.logger.error(`Error al grabar llamada: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // Método para reproducir audio en el canal
  async playAudio(channelId: string, audioFile: string): Promise<void> {
    try {
      const playback = await this.client.channels.play({
        channelId,
        media: `sound:${audioFile}`,
      });

      this.logger.log(`Reproduciendo audio: ${audioFile}`);

      // Esperar a que termine la reproducción
      return new Promise((resolve) => {
        playback.once('PlaybackFinished', () => {
          this.logger.log(`Reproducción finalizada: ${audioFile}`);
          resolve();
        });
      });
    } catch (error) {
      this.logger.error(`Error al reproducir audio: ${error.message}`);
      throw error;
    }
  }

  // Método para colgar una llamada
  async hangupCall(channelId: string): Promise<void> {
    try {
      await this.client.channels.hangup({
        channelId,
        reason: 'normal',
      });
      this.logger.log(`Llamada finalizada: ${channelId}`);
    } catch (error) {
      this.logger.error(`Error al finalizar llamada: ${error.message}`);
      throw error;
    }
  }

  // Método para responder una llamada
  async answerCall(channelId: string): Promise<void> {
    try {
      await this.client.channels.answer({ channelId });
      this.logger.log(`Llamada respondida: ${channelId}`);
    } catch (error) {
      this.logger.error(`Error al responder llamada: ${error.message}`);
      throw error;
    }
  }
}
