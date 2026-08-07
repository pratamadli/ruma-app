import { Injectable } from '@nestjs/common';
import type { HealthResponse, ReadyResponse } from '@ruma/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'ruma-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getReady(): Promise<ReadyResponse> {
    let database: ReadyResponse['database'] = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ready' : 'not_ready',
      service: 'ruma-api',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
