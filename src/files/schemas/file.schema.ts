import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FileDocument = HydratedDocument<FileDoc>;

export enum FileType {
  Txt = 'txt',
  Md = 'md',
}

@Schema({ timestamps: true })
export class FileDoc {

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: FileType, required: true })
  type: FileType;

  @Prop({ required: true })
  size: number;

  @Prop({ type: Types.ObjectId, required: true })
  gridFsId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Folder', default: null })
  folderId: Types.ObjectId | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: Types.ObjectId, default: null })
  trashRootId: Types.ObjectId | null;

}

export const FileSchema = SchemaFactory.createForClass(FileDoc);

FileSchema.index({ ownerId: 1, folderId: 1, deletedAt: 1 });
FileSchema.index({ name: 'text', tags: 'text' });
FileSchema.index({ createdAt: 1 });
