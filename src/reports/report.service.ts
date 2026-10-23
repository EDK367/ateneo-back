import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { FileDoc, FileDocument, FileType } from '../files/schemas/file.schema.js';
import { Folder, FolderDocument } from '../folders/schemas/folder.schema.js';
import {
  Share,
  ShareDocument,
  ShareResourceType,
} from '../shares/schemas/share.schema.js';
import { User, UserDocument } from '../user/schemas/user.schema.js';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema.js';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(FileDoc.name)
    private readonly fileModel: Model<FileDocument>,
    @InjectModel(Folder.name)
    private readonly folderModel: Model<FolderDocument>,
    @InjectModel(Share.name)
    private readonly shareModel: Model<ShareDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) {}

  async getDashboardStats(userId: string) {
    const ownerId = new Types.ObjectId(userId);

    const [
      user,
      mdCount,
      txtCount,
      totalFiles,
      foldersCount,
      sharedByMeCount,
      sharedWithMeCount,
    ] = await Promise.all([
      this.userModel.findById(ownerId).select('storageUsedBytes').exec(),
      this.fileModel.countDocuments({ ownerId, type: FileType.Md, deletedAt: null }),
      this.fileModel.countDocuments({ ownerId, type: FileType.Txt, deletedAt: null }),
      this.fileModel.countDocuments({ ownerId, deletedAt: null }),
      this.folderModel.countDocuments({ ownerId, deletedAt: null }),
      this.shareModel.countDocuments({ ownerId }),
      this.shareModel.countDocuments({ sharedWithId: ownerId }),
    ]);

    const storageUsedBytes = user?.storageUsedBytes || 0;
    const storageLimitBytes = 5 * 1024 * 1024 * 1024;
    const storageAvailableBytes = Math.max(0, storageLimitBytes - storageUsedBytes);
    const storagePercentage =
      storageLimitBytes > 0
        ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))
        : 0;

    return {
      storageUsedBytes,
      storageLimitBytes,
      storageAvailableBytes,
      storagePercentage,
      mdCount,
      txtCount,
      totalFiles,
      foldersCount,
      sharedCount: sharedByMeCount + sharedWithMeCount,
      sharedByMeCount,
      sharedWithMeCount,
    };
  }

  async getGlobalStats() {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      storageAggregate,
      mdCount,
      txtCount,
      totalFiles,
      foldersCount,
      sharedCount,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ isActive: false }),
      this.userModel.aggregate([
        { $group: { _id: null, totalStorage: { $sum: '$storageUsedBytes' } } },
      ]),
      this.fileModel.countDocuments({ type: FileType.Md, deletedAt: null }),
      this.fileModel.countDocuments({ type: FileType.Txt, deletedAt: null }),
      this.fileModel.countDocuments({ deletedAt: null }),
      this.folderModel.countDocuments({ deletedAt: null }),
      this.shareModel.countDocuments(),
    ]);

    const storageUsedBytes = storageAggregate[0]?.totalStorage || 0;
    const storageLimitBytes = 5 * 1024 * 1024 * 1024;
    const storageAvailableBytes = Math.max(0, storageLimitBytes - storageUsedBytes);
    const storagePercentage =
      storageLimitBytes > 0
        ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))
        : 0;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      storageUsedBytes,
      storageLimitBytes,
      storageAvailableBytes,
      storagePercentage,
      mdCount,
      txtCount,
      totalFiles,
      foldersCount,
      sharedCount,
    };
  }

  async getFilesByType() {
    return this.fileModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalBytes: { $sum: '$size' },
        },
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1,
          totalBytes: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getFilesByDateRange(startDate?: string, endDate?: string) {
    const filter: any = { deletedAt: null };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    return this.fileModel.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $lookup: {
          from: 'folders',
          localField: 'folderId',
          foreignField: '_id',
          as: 'folder',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          size: 1,
          createdAt: 1,
          ownerName: { $arrayElemAt: ['$owner.username', 0] },
          folderName: {
            $ifNull: [{ $arrayElemAt: ['$folder.name', 0] }, 'Raíz'],
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async getFilesMostOperations(limit = 10) {
    return this.activityModel.aggregate([
      { $match: { resourceType: 'file' } },
      {
        $group: {
          _id: '$resourceId',
          resourceName: { $first: '$resourceName' },
          operationsCount: { $sum: 1 },
          lastAction: { $last: '$action' },
          lastActivityDate: { $max: '$createdAt' },
        },
      },
      {
        $lookup: {
          from: 'filedocs',
          localField: '_id',
          foreignField: '_id',
          as: 'file',
        },
      },
      {
        $project: {
          _id: 1,
          fileName: {
            $ifNull: [{ $arrayElemAt: ['$file.name', 0] }, '$resourceName'],
          },
          fileType: { $arrayElemAt: ['$file.type', 0] },
          operationsCount: 1,
          lastAction: 1,
          lastActivityDate: 1,
        },
      },
      { $sort: { operationsCount: -1 } },
      { $limit: limit },
    ]);
  }

  async getTopUsersWithMostFiles() {
    return this.fileModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$ownerId',
          totalFiles: { $sum: 1 },
          totalBytes: { $sum: '$size' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          userId: '$_id',
          username: '$user.username',
          email: '$user.email',
          totalFiles: 1,
          totalBytes: 1,
        },
      },
      { $sort: { totalFiles: -1 } },
      { $limit: 10 },
    ]);
  }

  async getTopUsersWithMostShares(limit = 10) {
    return this.shareModel.aggregate([
      {
        $group: {
          _id: '$ownerId',
          sharesCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          userId: '$_id',
          username: '$user.username',
          email: '$user.email',
          sharesCount: 1,
        },
      },
      { $sort: { sharesCount: -1 } },
      { $limit: limit },
    ]);
  }

  async getResourcesSharedByUser(userId: string) {
    const ownerId = new Types.ObjectId(userId);
    return this.shareModel.aggregate([
      { $match: { ownerId } },
      {
        $lookup: {
          from: 'users',
          localField: 'sharedWithId',
          foreignField: '_id',
          as: 'sharedWith',
        },
      },
      {
        $lookup: {
          from: 'filedocs',
          localField: 'resourceId',
          foreignField: '_id',
          as: 'file',
        },
      },
      {
        $lookup: {
          from: 'folders',
          localField: 'resourceId',
          foreignField: '_id',
          as: 'folder',
        },
      },
      {
        $project: {
          _id: 1,
          resourceType: 1,
          resourceId: 1,
          resourceName: {
            $ifNull: [
              { $arrayElemAt: ['$file.name', 0] },
              { $arrayElemAt: ['$folder.name', 0] },
            ],
          },
          sharedWithUsername: { $arrayElemAt: ['$sharedWith.username', 0] },
          sharedWithEmail: { $arrayElemAt: ['$sharedWith.email', 0] },
          permission: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async getResourcesReceivedByUser(userId: string) {
    const sharedWithId = new Types.ObjectId(userId);
    return this.shareModel.aggregate([
      { $match: { sharedWithId } },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $lookup: {
          from: 'filedocs',
          localField: 'resourceId',
          foreignField: '_id',
          as: 'file',
        },
      },
      {
        $lookup: {
          from: 'folders',
          localField: 'resourceId',
          foreignField: '_id',
          as: 'folder',
        },
      },
      {
        $project: {
          _id: 1,
          resourceType: 1,
          resourceId: 1,
          resourceName: {
            $ifNull: [
              { $arrayElemAt: ['$file.name', 0] },
              { $arrayElemAt: ['$folder.name', 0] },
            ],
          },
          ownerUsername: { $arrayElemAt: ['$owner.username', 0] },
          ownerEmail: { $arrayElemAt: ['$owner.email', 0] },
          permission: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async getNeverSharedFiles(limit = 50) {
    const sharedFileIds = await this.shareModel.distinct('resourceId', {
      resourceType: ShareResourceType.File,
    });

    return this.fileModel.aggregate([
      {
        $match: {
          deletedAt: null,
          _id: { $nin: sharedFileIds },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $lookup: {
          from: 'folders',
          localField: 'folderId',
          foreignField: '_id',
          as: 'folder',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          size: 1,
          createdAt: 1,
          ownerName: { $arrayElemAt: ['$owner.username', 0] },
          folderName: {
            $ifNull: [{ $arrayElemAt: ['$folder.name', 0] }, 'Raíz'],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ]);
  }

  async getFoldersWithMostFiles(limit = 10) {
    return this.fileModel.aggregate([
      {
        $match: {
          deletedAt: null,
          folderId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$folderId',
          filesCount: { $sum: 1 },
          totalBytes: { $sum: '$size' },
        },
      },
      {
        $lookup: {
          from: 'folders',
          localField: '_id',
          foreignField: '_id',
          as: 'folder',
        },
      },
      { $unwind: '$folder' },
      {
        $lookup: {
          from: 'users',
          localField: 'folder.ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $project: {
          _id: 1,
          folderId: '$_id',
          folderName: '$folder.name',
          ownerName: { $arrayElemAt: ['$owner.username', 0] },
          filesCount: 1,
          totalBytes: 1,
        },
      },
      { $sort: { filesCount: -1 } },
      { $limit: limit },
    ]);
  }

  async getFilesSharedWithMostUsers(limit = 10) {
    return this.shareModel.aggregate([
      { $match: { resourceType: 'file' } },
      {
        $group: {
          _id: '$resourceId',
          sharedUsers: { $addToSet: '$sharedWithId' },
        },
      },
      {
        $project: {
          _id: 1,
          sharedWithCount: { $size: '$sharedUsers' },
        },
      },
      {
        $lookup: {
          from: 'filedocs',
          localField: '_id',
          foreignField: '_id',
          as: 'file',
        },
      },
      { $unwind: '$file' },
      {
        $lookup: {
          from: 'users',
          localField: 'file.ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $project: {
          _id: 1,
          fileName: '$file.name',
          fileType: '$file.type',
          fileSize: '$file.size',
          ownerName: { $arrayElemAt: ['$owner.username', 0] },
          sharedWithCount: 1,
        },
      },
      { $sort: { sharedWithCount: -1 } },
      { $limit: limit },
    ]);
  }
}
