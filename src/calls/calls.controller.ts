import { Controller, Get, Param } from '@nestjs/common';
import { CallsService } from './calls.service';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  getAllActiveCalls() {
    return {
      active_calls: this.callsService.getAllActiveSessions(),
      count: this.callsService.getAllActiveSessions().length,
    };
  }

  @Get('history')
  getCallHistory() {
    return {
      call_history: this.callsService.getCallHistory(),
      count: this.callsService.getCallHistory().length,
    };
  }

  @Get(':channelId')
  getCallDetails(@Param('channelId') channelId: string) {
    const session = this.callsService.getSession(channelId);
    if (!session) {
      return { error: 'Call not found' };
    }
    return { call: session };
  }
}