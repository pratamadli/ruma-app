import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadApiEnv } from './config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JsonLogger } from './common/logging/json-logger';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { initSentry } from './observability/sentry';

async function bootstrap() {
  const env = loadApiEnv();
  initSentry(env);

  const app = await NestFactory.create(AppModule, {
    logger: env.NODE_ENV === 'production' ? new JsonLogger() : ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('v1');
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  });

  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`RUMA API listening on http://0.0.0.0:${env.PORT}/v1`, 'Bootstrap');
}

void bootstrap();
