import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import {
  Activity,
  ActivityAction,
  ActivityDocument,
  ActivityResourceType,
} from './schemas/activity.schema.js';
import { FileDoc, FileDocument } from '../files/schemas/file.schema.js';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(FileDoc.name)
    private readonly fileModel: Model<FileDocument>,
  ) {}

  async findAll(userId: string, limit = 20): Promise<any[]> {
    const ownerId = new Types.ObjectId(userId);
    const activities = await this.activityModel
      .find({ userId: ownerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    if (activities.length > 0) {
      return activities;
    }

    const recentFiles = await this.fileModel
      .find({ ownerId, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return recentFiles.map((file) => {
      const doc = file as any;
      return {
        _id: doc._id,
        userId: doc.ownerId,
        action: ActivityAction.Upload,
        resourceType: ActivityResourceType.File,
        resourceId: doc._id,
        resourceName: doc.name,
        details: {
          size: doc.size,
          type: doc.type,
        },
        createdAt: doc.updatedAt || doc.createdAt || new Date(),
      };
    });
  }

  async log(
    userId: string,
    action: ActivityAction,
    resourceType: ActivityResourceType,
    resourceId: string | Types.ObjectId,
    resourceName?: string,
    details?: Record<string, any>,
  ): Promise<ActivityDocument> {
    return this.activityModel.create({
      userId: new Types.ObjectId(userId),
      action,
      resourceType,
      resourceId: new Types.ObjectId(resourceId),
      resourceName,
      details,
    });
  }
}
