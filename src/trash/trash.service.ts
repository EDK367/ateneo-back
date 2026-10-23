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

  async findAll(userId: string, role?: string) {
    const filter: any = {
      deletedAt: { $ne: null },
      $or: [
        { trashRootId: null },
        { $expr: { $eq: ['$trashRootId', '$_id'] } },
      ],
    };

    if (role !== 'admin') {
      filter.ownerId = new Types.ObjectId(userId);
    }

    const folders = await this.folderModel
      .find(filter)
      .sort({ deletedAt: -1 })
      .exec();

    const files = await this.fileModel
      .find(filter)
      .sort({ deletedAt: -1 })
      .exec();

    return {
      folders,
      files,
    };
  }

  async restore(userId: string, id: string, role?: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Elemento no encontrado en la papelera');
    }
    const ownerId = new Types.ObjectId(userId);
    const targetId = new Types.ObjectId(id);

    const folderFilter: any = {
      _id: targetId,
      deletedAt: { $ne: null },
    };
    if (role !== 'admin') {
      folderFilter.ownerId = ownerId;
    }

    const folder = await this.folderModel.findOne(folderFilter);

    if (folder) {
      const folderOwnerId = folder.ownerId;
      let nextParentId: Types.ObjectId | null = null;
      let newAncestors: Types.ObjectId[] = [];

      if (folder.parentId) {
        const parent = await this.folderModel.findOne({
          _id: folder.parentId,
          ownerId: folderOwnerId,
          deletedAt: null,
        });

        if (parent) {
          nextParentId = parent._id;
          newAncestors = [...parent.ancestors, parent._id];
        }
      }

      const collision = await this.folderModel.findOne({
        _id: { $ne: folder._id },
        ownerId: folderOwnerId,
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
        ownerId: folderOwnerId,
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
        { ownerId: folderOwnerId, trashRootId: folder._id },
        { $set: { deletedAt: null, trashRootId: null } },
      );

      await this.fileModel.updateMany(
        { ownerId: folderOwnerId, trashRootId: folder._id },
        { $set: { deletedAt: null, trashRootId: null } },
      );

      return folder;
    }

    const fileFilter: any = {
      _id: targetId,
      deletedAt: { $ne: null },
    };
    if (role !== 'admin') {
      fileFilter.ownerId = ownerId;
    }

    const fileDoc = await this.fileModel.findOne(fileFilter);

    if (fileDoc) {
      const fileOwnerId = fileDoc.ownerId;
      let nextFolderId: Types.ObjectId | null = null;

      if (fileDoc.folderId) {
        const parent = await this.folderModel.findOne({
          _id: fileDoc.folderId,
          ownerId: fileOwnerId,
          deletedAt: null,
        });

        if (parent) {
          nextFolderId = parent._id;
        }
      }

      const collision = await this.fileModel.findOne({
        _id: { $ne: fileDoc._id },
        ownerId: fileOwnerId,
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

  async purge(userId: string, id: string, role?: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Elemento no encontrado en la papelera');
    }
    const ownerId = new Types.ObjectId(userId);
    const targetId = new Types.ObjectId(id);

    const folderFilter: any = {
      _id: targetId,
      deletedAt: { $ne: null },
    };
    if (role !== 'admin') {
      folderFilter.ownerId = ownerId;
    }

    const folder = await this.folderModel.findOne(folderFilter);

    if (folder) {
      const folderOwnerId = folder.ownerId;
      const descendantFolders = await this.folderModel.find({
        ownerId: folderOwnerId,
        ancestors: folder._id,
      });

      const allFolderIds = [folder._id, ...descendantFolders.map((f) => f._id)];

      const files = await this.fileModel.find({
        ownerId: folderOwnerId,
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
        await this.userModel.findByIdAndUpdate(folderOwnerId, {
          $inc: { storageUsedBytes: -totalBytes },
        });
      }

      await this.fileModel.deleteMany({
        _id: { $in: files.map((f) => f._id) },
      });

      await this.folderModel.deleteMany({
        _id: { $in: allFolderIds },
      });

      return { message: 'Carpeta y su contenido purgados exitosamente' };
    }

    const fileFilter: any = {
      _id: targetId,
      deletedAt: { $ne: null },
    };
    if (role !== 'admin') {
      fileFilter.ownerId = ownerId;
    }

    const fileDoc = await this.fileModel.findOne(fileFilter);

    if (fileDoc) {
      try {
        await this.gridFsService.delete(fileDoc.gridFsId);
      } catch {}

      if (fileDoc.size && fileDoc.size > 0) {
        await this.userModel.findByIdAndUpdate(fileDoc.ownerId, {
          $inc: { storageUsedBytes: -fileDoc.size },
        });
      }

      await this.fileModel.findByIdAndDelete(fileDoc._id);

      return { message: 'Archivo purgado exitosamente' };
    }

    throw new NotFoundException('Elemento no encontrado en la papelera');
  }

  async emptyTrash(userId: string, role?: string) {
    const filter: any = {
      deletedAt: { $ne: null },
    };
    if (role !== 'admin') {
      filter.ownerId = new Types.ObjectId(userId);
    }

    const files = await this.fileModel.find(filter);

    const userBytesMap = new Map<string, number>();

    for (const file of files) {
      const bytes = file.size || 0;
      const ownerStr = file.ownerId.toString();
      userBytesMap.set(ownerStr, (userBytesMap.get(ownerStr) || 0) + bytes);

      try {
        await this.gridFsService.delete(file.gridFsId);
      } catch {}
    }

    for (const [ownerStr, totalBytes] of userBytesMap.entries()) {
      if (totalBytes > 0) {
        await this.userModel.findByIdAndUpdate(new Types.ObjectId(ownerStr), {
          $inc: { storageUsedBytes: -totalBytes },
        });
      }
    }

    await this.fileModel.deleteMany(filter);
    await this.folderModel.deleteMany(filter);

    return { message: 'Papelera vaciada exitosamente' };
  }
}
