import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import {
  TranscriptionRequest,
  TranscriptionResponse,
  TextToSpeechRequest,
  TextToSpeechResponse,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './interfaces/openai.interface';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private openai: OpenAI;
  
  // Directorio para almacenar archivos de audio temporales
  private readonly tempDir = path.join(process.cwd(), 'temp');

  constructor(private configService: ConfigService) {
    // Inicializar cliente de OpenAI
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
    
    // Asegurar que el directorio temporal existe
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Transcribe un archivo de audio a texto utilizando OpenAI Whisper
   */
  async transcribeAudio(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    try {
      this.logger.log(`Transcribiendo audio: ${request.audioFilePath}`);
      
      const file = fs.createReadStream(request.audioFilePath);
      
      const response = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: request.language,
      });
      
      this.logger.log('Transcripción completada');
      
      return {
        text: response.text,
        language: request.language,
      };
    } catch (error) {
      this.logger.error(`Error en transcripción: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convierte texto a voz utilizando la API de OpenAI
   */
  async textToSpeech(request: TextToSpeechRequest): Promise<TextToSpeechResponse> {
    try {
      this.logger.log(`Convirtiendo texto a voz: "${request.text.substring(0, 30)}..."`);
      
      const outputFormat = request.outputFormat || 'mp3';
      const voice = "nova"  // voces disponibles: alloy, echo, fable, onyx, nova, shimmer
      
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: request.text,
      });
      
      // Guardar el archivo de audio
      const outputFileName = `tts-${Date.now()}.${outputFormat}`;
      const outputPath = path.join(this.tempDir, outputFileName);
      
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      
      this.logger.log(`Archivo de audio generado: ${outputPath}`);
      
      return {
        audioFilePath: outputPath,
      };
    } catch (error) {
      this.logger.error(`Error en text-to-speech: ${error.message}`);
      throw error;
    }
  }

  /**
   * Genera una respuesta de texto usando GPT
   */
  async generateChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      this.logger.log('Generando respuesta con GPT');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',  // o gpt-3.5-turbo para una opción más económica
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 500,
      });
      
      const message = response.choices[0].message;
      
      this.logger.log('Respuesta generada con éxito');
      
      return {
        content: message.content,
        role: message.role,
      };
    } catch (error) {
      this.logger.error(`Error al generar respuesta: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Procesa una conversación completa: transcribe audio, genera respuesta y convierte a voz
   */
  async processConversation(audioFilePath: string): Promise<string> {
    try {
      // 1. Transcribir audio a texto
      const transcription = await this.transcribeAudio({
        audioFilePath,
      });
      
      // 2. Generar respuesta usando GPT
      const completion = await this.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente telefónico amable y eficiente que ayuda a los clientes con sus consultas. Proporciona respuestas claras y concisas.'
          },
          {
            role: 'user',
            content: transcription.text,
          },
        ],
      });
      
      // 3. Convertir respuesta a voz
      const speech = await this.textToSpeech({
        text: completion.content,
        voice: 'nova', // Voz más natural
        outputFormat: 'wav', // Formato compatible con Asterisk
      });
      
      return speech.audioFilePath;
    } catch (error) {
      this.logger.error(`Error en el procesamiento de la conversación: ${error.message}`);
      throw error;
    }
  }
  async processConversationExample(): Promise<string> {
    try {
     
      
      // 2. Generar respuesta usando GPT
      const completion = await this.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente telefónico amable y eficiente de la empresa Node Analytics. Que tiene un conjunto de herramientas para gestión de SAC y la insignia del servicio es la omnicanalidad, enfoncandose en canales escritos de redes sociales que incluyen Facebook, instragam y Whatsapp, además de los canales tradicionales de voz en call center y correo electronico, el beneficio más grande es la flexibilidad para poder adaptar la plataforma a los clientes, ya que la empresa es propietaria del codigo de la plataforma '
          },
          {
            role: 'user',
            content: "Qué tan adaptable es la plataforma de Node Analytics para los clientes?",
          },
        ],
      });
      
       // 3. Convertir respuesta a voz
      const speech = await this.textToSpeech({
        text: completion.content,
        voice: 'nova', // Voz más natural
        outputFormat: 'wav', // Formato compatible con Asterisk
      });
      console.log(speech.audioFilePath);
      
      return speech.audioFilePath; 
      return "/var/www/issabel-openai-integration/temp/tts-1741284202139.wav";
    } catch (error) {
      this.logger.error(`Error en el procesamiento de la conversación: ${error.message}`);
      throw error;
    }
  }
}