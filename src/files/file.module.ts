import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileController } from './file.controller.js';
import { FileService } from './file.service.js';
import { GridFsService } from './gridfs.service.js';
import { FileDoc, FileSchema } from './schemas/file.schema.js';
import { Folder, FolderSchema } from '../folders/schemas/folder.schema.js';
import { User, UserSchema } from '../user/schemas/user.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FileDoc.name, schema: FileSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FileController],
  providers: [FileService, GridFsService],
  exports: [FileService, GridFsService],
})
export class FileModule {}
