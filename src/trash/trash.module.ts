import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrashController } from './trash.controller.js';
import { TrashService } from './trash.service.js';
import { Folder, FolderSchema } from '../folders/schemas/folder.schema.js';
import { FileDoc, FileSchema } from '../files/schemas/file.schema.js';
import { User, UserSchema } from '../user/schemas/user.schema.js';
import { FileModule } from '../files/file.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Folder.name, schema: FolderSchema },
      { name: FileDoc.name, schema: FileSchema },
      { name: User.name, schema: UserSchema },
    ]),
    FileModule,
  ],
  controllers: [TrashController],
  providers: [TrashService],
  exports: [TrashService],
})
export class TrashModule {}
