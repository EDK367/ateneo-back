import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FolderController } from './folder.controller.js';
import { FolderService } from './folder.service.js';
import { Folder, FolderSchema } from './schemas/folder.schema.js';
import { FileDoc, FileSchema } from '../files/schemas/file.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Folder.name, schema: FolderSchema },
      { name: FileDoc.name, schema: FileSchema },
    ]),
  ],
  controllers: [FolderController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FolderModule {}
