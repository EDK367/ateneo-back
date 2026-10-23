import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/schemas/user.schema.js';
import { Folder, FolderSchema } from '../folders/schemas/folder.schema.js';
import { FileDoc, FileSchema } from '../files/schemas/file.schema.js';
import { Share, ShareSchema } from '../shares/schemas/share.schema.js';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema.js';
import { GridFsService } from '../files/gridfs.service.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: FileDoc.name, schema: FileSchema },
      { name: Share.name, schema: ShareSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  providers: [SeedService, GridFsService],
  exports: [SeedService],
})
export class SeedModule {}
