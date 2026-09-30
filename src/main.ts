import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference';

// configuraciones globales
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // prefijo global
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      // eliminar lo que no esta en el dto
      whitelist: true,
      // rechaza request con propiedades extras
      forbidNonWhitelisted: true,
      // transforma automaticamente los valores (string -> number, boolen)
      transform: true,
    }),
  );

  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:4200'],
    credentials: true
  });

  // swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sistema Ateneo')
    .setDescription('API REST del servidor de ateneo backend')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('folders')
    .addTag('files')
    .addTag('shares')
    .addTag('trash')
    .addTag('activity')
    .addTag('reports')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // desabilitar swagger
  SwaggerModule.setup('api', app, document, { ui: false, raw: ['json'] });

  app.use(
    '/docs',
    apiReference({
      content: document,
      theme: 'purple',
      pageTitle: 'SGD API Reference',
    }),
  );

  await app.listen(process.env.PORT ?? 3000);

}
void bootstrap();