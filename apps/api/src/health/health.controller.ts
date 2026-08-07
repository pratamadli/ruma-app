import { Controller, Get } from '@nestjs/common';
import type { HealthResponse, ReadyResponse } from '@ruma/types';
import { HealthService } from './health.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Public()
  @Get('ready')
  getReady(): Promise<ReadyResponse> {
    return this.healthService.getReady();
  }
}
