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
    // Simplificar el ID del canal
    const simpleId = channelId.replace(/\./g, '-');
    
    // Crear un nombre de archivo único pero muy simple
    const timestamp = Date.now();
    const fileName = `call_${simpleId}_${timestamp}`;
    
    this.logger.log(`Starting ARI recording: 
      channelId: ${channelId}
      name: ${fileName} (sin directorio, solo nombre)
      format: ${format}
    `);
    
    // Intentar usar la API de snoop como alternativa que suele funcionar mejor
    const recording = await this.client.channels.record({
      channelId: channelId,
      name: fileName,
      format: format,
      // No incluir opciones adicionales que puedan causar problemas
    });
    
    // Obtener una referencia al ID de la grabación para seguimiento
    const recordingName = recording.name;
    this.logger.log(`Recording requested with ID: ${recordingName}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.logger.error('Recording start timeout');
        reject(new Error('Recording start timeout'));
      }, 10000);
      
      recording.once('RecordingStarted', async (event) => {
        clearTimeout(timeout);
        this.logger.log(`Recording started event: ${JSON.stringify(event)}`);
        
        // Buscar el archivo en las ubicaciones más comunes de Issabel/Asterisk
        const potentialLocations = [
          `/var/spool/asterisk/monitor/${fileName}.${format}`,
          `/var/lib/asterisk/recordings/${fileName}.${format}`,
          `/var/lib/asterisk/sounds/custom/${fileName}.${format}`,
          `/var/spool/asterisk/monitor/queue-${fileName}.${format}`,
          `/var/spool/asterisk/monitor/FROM-${fileName}.${format}`,
          `/var/spool/asterisk/monitor/g${fileName}.${format}`,
          `/tmp/${fileName}.${format}`
        ];
        
        this.logger.log(`Checking for recording file in potential locations...`);
        
        // Si conocemos la ruta exacta desde el evento, usarla primero
        let filePath = '';
        if (event && event.recording && event.recording.name) {
          filePath = event.recording.name;
          this.logger.log(`Using file path from event: ${filePath}`);
          
          // Verificar si este archivo existe
          try {
            const fs = require('fs');
            if (fs.existsSync(filePath)) {
              this.logger.log(`Found recording at: ${filePath}`);
              return resolve(filePath);
            } else {
              this.logger.log(`File from event does not exist: ${filePath}`);
            }
          } catch (err) {
            this.logger.error(`Error checking file path: ${err.message}`);
          }
        }
        
        // Si no pudimos obtener la ruta del evento o el archivo no existe,
        // buscar en ubicaciones potenciales
        try {
          const fs = require('fs');
          for (const location of potentialLocations) {
            this.logger.log(`Checking location: ${location}`);
            if (fs.existsSync(location)) {
              this.logger.log(`Found recording at: ${location}`);
              return resolve(location);
            }
          }
          
          // Si llegamos aquí, no encontramos el archivo en ninguna ubicación conocida
          this.logger.warn(`Recording file not found in any known location`);
          
          // Devuelve la primera ubicación potencial como una aproximación
          resolve(potentialLocations[0]);
        } catch (err) {
          this.logger.error(`Error searching for recording: ${err.message}`);
          resolve(potentialLocations[0]);
        }
      });
      
      recording.once('RecordingFailed', (event) => {
        clearTimeout(timeout);
        this.logger.error(`Recording failed event: ${JSON.stringify(event)}`);
        reject(new Error(`Recording failed: ${JSON.stringify(event)}`));
      });
    });
  } catch (error) {
    this.logger.error(`Error starting recording: ${error.message}`);
    this.logger.error(`Full error object: ${JSON.stringify(error, null, 2)}`);
    if (error.stack) {
      this.logger.error(`Stack trace: ${error.stack}`);
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
