import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { FileDoc, FileDocument, FileType } from '../files/schemas/file.schema.js';
import { Folder, FolderDocument } from '../folders/schemas/folder.schema.js';
import { Share, ShareDocument } from '../shares/schemas/share.schema.js';
import { User, UserDocument } from '../user/schemas/user.schema.js';

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
    const storagePercentage =
      storageLimitBytes > 0
        ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))
        : 0;

    return {
      storageUsedBytes,
      storageLimitBytes,
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
      storagePercentage,
      mdCount,
      txtCount,
      totalFiles,
      foldersCount,
      sharedCount,
    };
  }
}
