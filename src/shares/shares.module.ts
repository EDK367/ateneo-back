import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SharesController } from './shares.controller.js';
import { SharesService } from './shares.service.js';
import { Share, ShareSchema } from './schemas/share.schema.js';
import { FileDoc, FileSchema } from '../files/schemas/file.schema.js';
import { Folder, FolderSchema } from '../folders/schemas/folder.schema.js';
import { User, UserSchema } from '../user/schemas/user.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Share.name, schema: ShareSchema },
      { name: FileDoc.name, schema: FileSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
