import { Controller, Post, Body, Get } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import {
  TranscriptionRequest,
  TextToSpeechRequest,
  ChatCompletionRequest,
} from './interfaces/openai.interface';

@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Get()
  getStatus() {
    return {
      status: 'OpenAI service active',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('transcribe')
  async transcribeAudio(@Body() request: TranscriptionRequest) {
    return this.openaiService.transcribeAudio(request);
  }

  @Post('text-to-speech')
  async textToSpeech(@Body() request: TextToSpeechRequest) {
    return this.openaiService.textToSpeech(request);
  }

  @Post('chat')
  async generateChatCompletion(@Body() request: ChatCompletionRequest) {
    return this.openaiService.generateChatCompletion(request);
  }

  @Post('process-conversation')
  async processConversation(@Body() request: { audioFilePath: string }) {
    const responseAudioPath = await this.openaiService.processConversation(
      request.audioFilePath,
    );
    return { responseAudioPath };
  }
}