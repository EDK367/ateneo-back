import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { SeedService } from './seed.service.js';

async function bootstrap() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const seedService = app.get(SeedService);
    await seedService.seed();
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void bootstrap();
