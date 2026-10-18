import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';
import { FileDoc, FileSchema } from '../files/schemas/file.schema.js';
import { Folder, FolderSchema } from '../folders/schemas/folder.schema.js';
import { Share, ShareSchema } from '../shares/schemas/share.schema.js';
import { User, UserSchema } from '../user/schemas/user.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FileDoc.name, schema: FileSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: Share.name, schema: ShareSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
