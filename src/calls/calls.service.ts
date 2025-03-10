import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AriService } from '../ari/ari.service';
import { OpenaiService } from '../openai/openai.service';
import {
  CallSession,
  CallSessionRepository,
} from './interfaces/call.interface';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CallsService implements OnModuleInit, CallSessionRepository {
  private readonly logger = new Logger(CallsService.name);
  public sessions: Map<string, CallSession> = new Map();
  private readonly recordingsDir = path.join(process.cwd(), 'recordings');

  constructor(
    private readonly ariService: AriService,
    private readonly openaiService: OpenaiService,
  ) {
    // Asegurar que el directorio de grabaciones existe
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  async onModuleInit() {
    // Suscribirse a eventos de llamadas desde ARI
    this.ariService.callEvents.subscribe(async (event) => {
      if (event.type === 'call_start' && event.channel) {
        await this.handleIncomingCall(
          event.channel.id,
          event.channel.caller.name,
          event.channel.caller.number,
        );
      } else if (event.type === 'call_end' && event.channel) {
        await this.handleCallEnd(event.channel.id);
      }
    });
  }

  // Implementación del repositorio de sesiones
  createSession(
    channelId: string,
    callerId: string,
    callerNumber: string,
  ): CallSession {
    const session: CallSession = {
      channelId,
      callerId,
      callerNumber,
      startTime: new Date(),
      recordings: [],
      transcriptions: [],
      responses: [],
    };

    this.sessions.set(channelId, session);
    return session;
  }

  getSession(channelId: string): CallSession | undefined {
    return this.sessions.get(channelId);
  }

  updateSession(channelId: string, updates: Partial<CallSession>): CallSession {
    const session = this.getSession(channelId);
    if (!session) {
      throw new Error(`No se encontró la sesión para el canal ${channelId}`);
    }

    const updatedSession = { ...session, ...updates };
    this.sessions.set(channelId, updatedSession);
    return updatedSession;
  }

  endSession(channelId: string): void {
    const session = this.getSession(channelId);
    if (session) {
      session.endTime = new Date();
      this.sessions.set(channelId, session);
    }
  }

  addRecording(channelId: string, recordingPath: string): void {
    const session = this.getSession(channelId);
    if (session) {
      session.recordings.push(recordingPath);
      this.sessions.set(channelId, session);
    }
  }

  addTranscription(channelId: string, transcription: string): void {
    const session = this.getSession(channelId);
    if (session) {
      session.transcriptions.push(transcription);
      this.sessions.set(channelId, session);
    }
  }

  addResponse(channelId: string, response: string): void {
    const session = this.getSession(channelId);
    if (session) {
      session.responses.push(response);
      this.sessions.set(channelId, session);
    }
  }

  // Métodos de manejo de llamadas
  async handleIncomingCall(
    channelId: string,
    callerId: string,
    callerNumber: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Manejando llamada entrante: ${channelId} de ${callerNumber}`,
      );

      // Crear una nueva sesión de llamada
      this.createSession(channelId, callerId, callerNumber);

      // Responder la llamada
      await this.ariService.answerCall(channelId);

      // Reproducir mensaje de bienvenida
      await this.ariService.playAudio(channelId, 'custom/tts-1741305050975');
      await new Promise((resolve) => setTimeout(resolve, 7000));
      await this.ariService.playAudio(channelId, 'custom/tts-1741361871826');
      await new Promise((resolve) => setTimeout(resolve, 7000));
      await this.ariService.playAudio(channelId, 'custom/tts-1741362254708');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await this.ariService.playAudio(channelId, 'custom/tts-1741362459731');

      /*  // Iniciar grabación
      const recordingFileName = await this.ariService.recordCall(channelId);
      this.addRecording(channelId, recordingFileName);
      
      // Esperar 5 segundos para que el usuario hable
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Procesar la grabación con OpenAI
      const recordingPath = path.join(this.recordingsDir, recordingFileName); */
      //const responseAudioPath = await this.openaiService.processConversation(recordingPath);
      //const responseAudioPath = await this.openaiService.processConversationExample();

      // Reproducir la respuesta generada
      //await this.ariService.playAudio(channelId, responseAudioPath);

      // Finalizar la llamada
      await this.ariService.hangupCall(channelId);
    } catch (error) {
      this.logger.error(`Error al manejar llamada entrante: ${error.message}`);
      try {
        // Intentar colgar la llamada en caso de error
        await this.ariService.hangupCall(channelId);
      } catch (e) {
        this.logger.error(`No se pudo colgar la llamada: ${e.message}`);
      }
    }
  }

  async handleCallEnd(channelId: string): Promise<void> {
    this.logger.log(`Llamada finalizada: ${channelId}`);
    this.endSession(channelId);
  }

  // Método para obtener todas las sesiones activas
  getAllActiveSessions(): CallSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => !session.endTime,
    );
  }

  // Método para obtener el historial de llamadas
  getCallHistory(): CallSession[] {
    return Array.from(this.sessions.values())
      .filter((session) => session.endTime)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }
}
