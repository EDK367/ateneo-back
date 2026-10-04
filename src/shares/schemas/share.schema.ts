import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShareDocument = HydratedDocument<Share>;

export enum ShareResourceType {
  File = 'file',
  Folder = 'folder',
}

export enum SharePermission {
  Read = 'read',
  Comment = 'comment',
  Edit = 'edit',
}

@Schema({ timestamps: true })
export class Share {

  @Prop({ type: String, enum: ShareResourceType, required: true })
  resourceType: ShareResourceType;

  @Prop({ type: Types.ObjectId, required: true })
  resourceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sharedWithId: Types.ObjectId;

  @Prop({ type: String, enum: SharePermission, required: true })
  permission: SharePermission;

}

export const ShareSchema = SchemaFactory.createForClass(Share);

// creacion de indices para busquedas mas rapidas
ShareSchema.index(
  { resourceType: 1, resourceId: 1, sharedWithId: 1 },
  { unique: true },
);
ShareSchema.index({ sharedWithId: 1 });
ShareSchema.index({ ownerId: 1 });
