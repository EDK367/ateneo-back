import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Folder, FolderDocument } from '../folders/schemas/folder.schema.js';
import { FileDoc, FileDocument } from '../files/schemas/file.schema.js';
import { User, UserDocument } from '../user/schemas/user.schema.js';
import { GridFsService } from '../files/gridfs.service.js';

@Injectable()
export class TrashService {
  constructor(
    @InjectModel(Folder.name) private readonly folderModel: Model<FolderDocument>,
    @InjectModel(FileDoc.name) private readonly fileModel: Model<FileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly gridFsService: GridFsService,
  ) {}

  async findAll(userId: string) {

    const ownerId = new Types.ObjectId(userId);

    const folders = await this.folderModel
      .find({
        ownerId,
        deletedAt: { $ne: null },
        $or: [
          { trashRootId: null },
          { $expr: { $eq: ['$trashRootId', '$_id'] } },
        ],
      })
      .sort({ deletedAt: -1 })
      .exec();

    const files = await this.fileModel
      .find({
        ownerId,
        deletedAt: { $ne: null },
        $or: [
          { trashRootId: null },
          { $expr: { $eq: ['$trashRootId', '$_id'] } },
        ],
      })
      .sort({ deletedAt: -1 })
      .exec();

    return {
      folders,
      files,
    };
  }

  async restore(userId: string, id: string) {

    const ownerId = new Types.ObjectId(userId);
    const targetId = new Types.ObjectId(id);

    const folder = await this.folderModel.findOne({
      _id: targetId,
      ownerId,
      deletedAt: { $ne: null },
    });

    if (folder) {
      let nextParentId: Types.ObjectId | null = null;
      let newAncestors: Types.ObjectId[] = [];

      if (folder.parentId) {
        const parent = await this.folderModel.findOne({
          _id: folder.parentId,
          ownerId,
          deletedAt: null,
        });

        if (parent) {
          nextParentId = parent._id;
          newAncestors = [...parent.ancestors, parent._id];
        }
      }

      const collision = await this.folderModel.findOne({
        _id: { $ne: folder._id },
        ownerId,
        parentId: nextParentId,
        name: folder.name,
        deletedAt: null,
      });

      if (collision) {
        throw new ConflictException('Ya existe una carpeta con ese nombre en la ubicación destino');
      }

      const updatedBaseAncestors = [...newAncestors, folder._id];

      folder.parentId = nextParentId;
      folder.ancestors = newAncestors;
      folder.deletedAt = null;
      folder.trashRootId = null;
      await folder.save();

      const descendants = await this.folderModel.find({
        ownerId,
        ancestors: folder._id,
      });

      for (const desc of descendants) {

        const idx = desc.ancestors.findIndex((a) => a.equals(folder._id));
        if (idx !== -1) {
          const childSuffix = desc.ancestors.slice(idx + 1);
          desc.ancestors = [...updatedBaseAncestors, ...childSuffix];
          await desc.save();
        }
      }

      await this.folderModel.updateMany(
        { ownerId, trashRootId: folder._id },
        { $set: { deletedAt: null, trashRootId: null } },
      );

      await this.fileModel.updateMany(
        { ownerId, trashRootId: folder._id },
        { $set: { deletedAt: null, trashRootId: null } },
      );

      return folder;
    }

    const fileDoc = await this.fileModel.findOne({
      _id: targetId,
      ownerId,
      deletedAt: { $ne: null },
    });

    if (fileDoc) {
      let nextFolderId: Types.ObjectId | null = null;

      if (fileDoc.folderId) {
        const parent = await this.folderModel.findOne({
          _id: fileDoc.folderId,
          ownerId,
          deletedAt: null,
        });

        if (parent) {
          nextFolderId = parent._id;
        }
      }

      const collision = await this.fileModel.findOne({
        _id: { $ne: fileDoc._id },
        ownerId,
        folderId: nextFolderId,
        name: fileDoc.name,
        deletedAt: null,
      });

      if (collision) {
        throw new ConflictException('Ya existe un archivo con ese nombre en la ubicación destino');
      }

      fileDoc.folderId = nextFolderId;
      fileDoc.deletedAt = null;
      fileDoc.trashRootId = null;
      return fileDoc.save();
    }

    throw new NotFoundException('Elemento no encontrado en la papelera');
  }

  async purge(userId: string, id: string) {
    const ownerId = new Types.ObjectId(userId);
    const targetId = new Types.ObjectId(id);

    const folder = await this.folderModel.findOne({
      _id: targetId,
      ownerId,
      deletedAt: { $ne: null },
    });

    if (folder) {
      const descendantFolders = await this.folderModel.find({
        ownerId,
        ancestors: folder._id,
      });

      const allFolderIds = [folder._id, ...descendantFolders.map((f) => f._id)];

      const files = await this.fileModel.find({
        ownerId,
        folderId: { $in: allFolderIds },
      });

      let totalBytes = 0;
      for (const file of files) {
        totalBytes += file.size || 0;
        try {
          await this.gridFsService.delete(file.gridFsId);
        } catch {}
      }

      if (totalBytes > 0) {
        await this.userModel.findByIdAndUpdate(ownerId, {
          $inc: { storageUsedBytes: -totalBytes },
        });
      }

      await this.fileModel.deleteMany({ _id: { $in: files.map((f) => f._id) } });
      await this.folderModel.deleteMany({ _id: { $in: allFolderIds } });

      return { message: 'Carpeta eliminada definitivamente' };
    }

    const fileDoc = await this.fileModel.findOne({
      _id: targetId,
      ownerId,
      deletedAt: { $ne: null },
    });

    if (fileDoc) {
      try {
        await this.gridFsService.delete(fileDoc.gridFsId);
      } catch {}

      if (fileDoc.size > 0) {
        await this.userModel.findByIdAndUpdate(ownerId, {
          $inc: { storageUsedBytes: -fileDoc.size },
        });
      }

      await this.fileModel.deleteOne({ _id: fileDoc._id });

      return { message: 'Archivo eliminado definitivamente' };
    }

    throw new NotFoundException('Elemento no encontrado en la papelera');
  }

  async emptyTrash(userId: string) {
    const ownerId = new Types.ObjectId(userId);

    const files = await this.fileModel.find({
      ownerId,
      deletedAt: { $ne: null },
    });

    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size || 0;
      try {
        await this.gridFsService.delete(file.gridFsId);
      } catch {}
    }

    if (totalBytes > 0) {
      await this.userModel.findByIdAndUpdate(ownerId, {
        $inc: { storageUsedBytes: -totalBytes },
      });
    }

    await this.fileModel.deleteMany({
      ownerId,
      deletedAt: { $ne: null },
    });

    await this.folderModel.deleteMany({
      ownerId,
      deletedAt: { $ne: null },
    });

    return { message: 'Papelera vaciada exitosamente' };
  }
}
