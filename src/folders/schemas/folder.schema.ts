import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FolderDocument = HydratedDocument<Folder>;

@Schema({ timestamps: true })
export class Folder {

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Folder', default: null })
  parentId: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], default: [] })
  ancestors: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: Types.ObjectId, default: null })
  trashRootId: Types.ObjectId | null;
}

export const FolderSchema = SchemaFactory.createForClass(Folder);

// creacion de indices para busquedas mas rapidas
FolderSchema.index(
  { ownerId: 1, parentId: 1, name: 1 },
  // nombres unicos y para elementos no eliminados
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

// busqeuda internas
FolderSchema.index({ ancestors: 1 });
