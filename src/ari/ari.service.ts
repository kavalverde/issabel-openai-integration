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
// Enhanced record call method with better error handling and simpler approach
async recordCall(channelId: string, format: string = 'wav'): Promise<string> {
  try {
    // Use a simple filename without special characters
    const simpleId = channelId.replace(/\./g, '-');
    const fileName = `call-${simpleId}-${Date.now()}`;
    
    // Log all recording parameters for debugging
    this.logger.log(`Starting recording with parameters: 
      channelId: ${channelId}
      name: ${fileName}
      format: ${format}
    `);
    
    // Create a recording with minimal parameters
    const recording = await this.client.channels.record({
      channelId: channelId,
      name: fileName,
      format: format
    });
    
    // Return full information about the recording for debugging
    this.logger.log(`Recording started: ${JSON.stringify(recording)}`);
    
    // Wait for the recording to start before returning
    return new Promise((resolve, reject) => {
      // Set a reasonable timeout
      const timeout = setTimeout(() => {
        this.logger.error('Recording start timeout');
        reject(new Error('Recording start timeout'));
      }, 5000);
      
      // Listen for recording events
      recording.once('RecordingStarted', (event) => {
        clearTimeout(timeout);
        this.logger.log(`Recording started event: ${JSON.stringify(event)}`);
        resolve(fileName + '.' + format);
      });
      
      recording.once('RecordingFailed', (event) => {
        clearTimeout(timeout);
        this.logger.error(`Recording failed event: ${JSON.stringify(event)}`);
        reject(new Error(`Recording failed: ${JSON.stringify(event)}`));
      });
    });
  } catch (error) {
    // Detailed error logging
    this.logger.error(`Error starting recording: ${error.message}`);
    if (error.stack) {
      this.logger.error(`Stack trace: ${error.stack}`);
    }
    
    // Log the full error object for inspection
    try {
      this.logger.error(`Full error object: ${JSON.stringify(error)}`);
    } catch (e) {
      this.logger.error(`Error serializing error object: ${e.message}`);
    }
    
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
