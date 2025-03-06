export interface CallSession {
    channelId: string;
    callerId: string;
    callerNumber: string;
    startTime: Date;
    endTime?: Date;
    recordings: string[];
    transcriptions: string[];
    responses: string[];
  }
  
  export interface CallSessionRepository {
    sessions: Map<string, CallSession>;
    
    createSession(channelId: string, callerId: string, callerNumber: string): CallSession;
    getSession(channelId: string): CallSession | undefined;
    updateSession(channelId: string, updates: Partial<CallSession>): CallSession;
    endSession(channelId: string): void;
    addRecording(channelId: string, recordingPath: string): void;
    addTranscription(channelId: string, transcription: string): void;
    addResponse(channelId: string, response: string): void;
  }