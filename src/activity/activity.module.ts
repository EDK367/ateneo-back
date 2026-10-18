import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from './schemas/activity.schema.js';
import { FileDoc, FileSchema } from '../files/schemas/file.schema.js';
import { ActivityService } from './activity.service.js';
import { ActivityController } from './activity.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: FileDoc.name, schema: FileSchema },
    ]),
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
