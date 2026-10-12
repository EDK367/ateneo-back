import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation.js';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { SeedModule } from './database/seed.module.js';
import { FolderModule } from './folders/folder.module.js';
import { FileModule } from './files/file.module.js';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard.js';
import { SharesController } from './shares/shares.controller.js';
import { TrashController } from './trash/trash.controller.js';
import { ReportController } from './reports/report.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('DB_MONGO_URI'),
      }),
    }),
    AuthModule,
    UserModule,
    FolderModule,
    FileModule,
    SeedModule,
  ],
  controllers: [
    AppController,
    SharesController,
    TrashController,
    ReportController,
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
