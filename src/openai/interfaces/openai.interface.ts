export interface TranscriptionRequest {
    audioFilePath: string;
    language?: string;
  }
  
  export interface TranscriptionResponse {
    text: string;
    language?: string;
  }
  
  export interface TextToSpeechRequest {
    text: string;
    voice?: string;
    outputFormat?: string;
  }
  
  export interface TextToSpeechResponse {
    audioFilePath: string;
  }
  
  export interface ChatCompletionRequest {
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
  }
  
  export interface ChatCompletionResponse {
    content: string;
    role: string;
  }