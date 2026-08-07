import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

describe('HealthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            getHealth: () => ({
              status: 'ok',
              service: 'ruma-api',
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
            getReady: async () => ({
              status: 'ready',
              service: 'ruma-api',
              database: 'up',
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /v1/health returns ok', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('ruma-api');
  });
});
