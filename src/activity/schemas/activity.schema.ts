import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ActivityDocument = HydratedDocument<Activity>;

export enum ActivityAction {
  Upload = 'upload',
  Download = 'download',
  Rename = 'rename',
  Move = 'move',
  Delete = 'delete',
  Restore = 'restore',
  Purge = 'purge',
  Share = 'share',
  Unshare = 'unshare',
}

export enum ActivityResourceType {
  File = 'file',
  Folder = 'folder',
  Share = 'share',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Activity {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ActivityAction, required: true })
  action: ActivityAction;

  @Prop({ type: String, enum: ActivityResourceType, required: true })
  resourceType: ActivityResourceType;

  @Prop({ type: Types.ObjectId, required: true })
  resourceId: Types.ObjectId;

  @Prop()
  resourceName: string;

  @Prop({ type: Object })
  details: Record<string, any>;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.index({ userId: 1, createdAt: -1 });
ActivitySchema.index({ resourceId: 1, createdAt: -1 });
ActivitySchema.index({ action: 1 });
