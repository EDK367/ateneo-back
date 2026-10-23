import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Folder, FolderDocument } from './schemas/folder.schema.js';
import { FileDoc, FileDocument } from '../files/schemas/file.schema.js';
import { CreateFolderDto } from './dto/folder.dto.js';
import {
  Share,
  ShareDocument,
  ShareResourceType,
} from '../shares/schemas/share.schema.js';

@Injectable()
export class FolderService {

  constructor(
    @InjectModel(Folder.name) private readonly folderModel: Model<FolderDocument>,
    @InjectModel(FileDoc.name) private readonly fileModel: Model<FileDocument>,
    @InjectModel(Share.name) private readonly shareModel: Model<ShareDocument>,
  ) {}

  async create(userId: string, dto: CreateFolderDto): Promise<FolderDocument> {

    const ownerId = new Types.ObjectId(userId);
    let parentId: Types.ObjectId | null = null;
    let ancestors: Types.ObjectId[] = [];

    const cleanParentId =
      dto.parentId &&
      dto.parentId !== 'null' &&
      dto.parentId !== 'undefined' &&
      dto.parentId.trim() !== ''
        ? dto.parentId.trim()
        : null;

    if (cleanParentId) {
      if (!Types.ObjectId.isValid(cleanParentId)) {
        throw new NotFoundException('Carpeta padre no encontrada');
      }
      // si se crea dentro de otro folder lo buscamos y verificamos que no este eliminado
      parentId = new Types.ObjectId(cleanParentId);
      const parent = await this.folderModel.findOne({
        _id: parentId,
        ownerId,
        deletedAt: null,
      });

      if (!parent) {
        throw new NotFoundException('Carpeta padre no encontrada');
      }

      // asignacion de los ancestors
      ancestors = [...parent.ancestors, parent._id];
    }

    const existing = await this.folderModel.findOne({
      ownerId,
      parentId,
      name: dto.name.trim(),
      deletedAt: null,
    });

    if (existing) {
      throw new ConflictException('Ya existe una carpeta con ese nombre en esta ubicación');
    }

    return this.folderModel.create({
      name: dto.name.trim(),
      ownerId,
      parentId,
      ancestors,
      deletedAt: null,
      trashRootId: null,
    });
  }

  async getContent(userId: string, folderId?: string, role?: string) {

    const ownerId = new Types.ObjectId(userId);
    let currentFolder: FolderDocument | null = null;
    const cleanFolderId =
      folderId &&
      folderId !== 'null' &&
      folderId !== 'undefined' &&
      folderId.trim() !== ''
        ? folderId.trim()
        : null;

    if (cleanFolderId && !Types.ObjectId.isValid(cleanFolderId)) {
      throw new NotFoundException('Carpeta no encontrada');
    }

    const parentId = cleanFolderId ? new Types.ObjectId(cleanFolderId) : null;

    if (parentId) {
      if (role === 'admin') {
        currentFolder = await this.folderModel.findOne({
          _id: parentId,
          deletedAt: null,
        });
      } else {
        currentFolder = await this.folderModel.findOne({
          _id: parentId,
          ownerId,
          deletedAt: null,
        });

        if (!currentFolder) {
          const candidateFolder = await this.folderModel.findOne({
            _id: parentId,
            deletedAt: null,
          });

          if (candidateFolder) {
            const folderIdsToCheck = [
              candidateFolder._id,
              ...(candidateFolder.ancestors || []),
            ];

            const share = await this.shareModel.findOne({
              resourceType: ShareResourceType.Folder,
              resourceId: { $in: folderIdsToCheck },
              sharedWithId: ownerId,
            });

            if (share) {
              currentFolder = candidateFolder;
            }
          }
        }
      }

      if (!currentFolder) {
        throw new NotFoundException('Carpeta no encontrada');
      }
    }

    const folderOwnerId = currentFolder ? currentFolder.ownerId : ownerId;

    const folders = await this.folderModel
      .find({
        ownerId: folderOwnerId,
        parentId,
        deletedAt: null,
      })
      .sort({ name: 1 })
      .exec();

    const files = await this.fileModel
      .find({
        ownerId: folderOwnerId,
        folderId: parentId,
        deletedAt: null,
      })
      .sort({ name: 1 })
      .exec();

    const folderIds = folders.map((f) => f._id);
    let subfolderCounts: { _id: Types.ObjectId; count: number }[] = [];
    let fileCounts: { _id: Types.ObjectId; count: number }[] = [];

    if (folderIds.length > 0) {
      [subfolderCounts, fileCounts] = await Promise.all([
        this.folderModel.aggregate([
          { $match: { parentId: { $in: folderIds }, deletedAt: null } },
          { $group: { _id: '$parentId', count: { $sum: 1 } } },
        ]),
        this.fileModel.aggregate([
          { $match: { folderId: { $in: folderIds }, deletedAt: null } },
          { $group: { _id: '$folderId', count: { $sum: 1 } } },
        ]),
      ]);
    }

    const subfolderMap = new Map<string, number>();
    for (const item of subfolderCounts) {
      subfolderMap.set(item._id.toString(), item.count);
    }

    const fileMap = new Map<string, number>();
    for (const item of fileCounts) {
      fileMap.set(item._id.toString(), item.count);
    }

    const foldersWithItemCount = folders.map((f) => {
      const fObj = f.toObject() as Record<string, any>;
      const count =
        (subfolderMap.get(f._id.toString()) || 0) +
        (fileMap.get(f._id.toString()) || 0);
      return Object.assign({}, fObj, { itemCount: count });
    });

    const currentFolderWithItemCount = currentFolder
      ? Object.assign({}, currentFolder.toObject() as Record<string, any>, {
          itemCount: folders.length + files.length,
        })
      : null;

    return {
      currentFolder: currentFolderWithItemCount,
      folders: foldersWithItemCount,
      files,
    };
  }

  async move(userId: string, folderId: string, newParentId?: string | null): Promise<FolderDocument> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(folderId)) {
      throw new NotFoundException('Carpeta no encontrada');
    }

    const ownerId = new Types.ObjectId(userId);
    const targetFolderId = new Types.ObjectId(folderId);

    const folder = await this.folderModel.findOne({
      _id: targetFolderId,
      ownerId,
      deletedAt: null,
    });

    if (!folder) {
      throw new NotFoundException('Carpeta no encontrada');
    }

    let nextParentId: Types.ObjectId | null = null;
    let newAncestors: Types.ObjectId[] = [];

    const cleanNewParentId =
      newParentId &&
      newParentId !== 'null' &&
      newParentId !== 'undefined' &&
      newParentId.trim() !== ''
        ? newParentId.trim()
        : null;

    if (cleanNewParentId) {
      // evitar movimiento circular
      if (folderId === cleanNewParentId) {
        throw new BadRequestException(
          'No puedes mover una carpeta dentro de sí misma',
        );
      }

      if (!Types.ObjectId.isValid(cleanNewParentId)) {
        throw new NotFoundException('Carpeta destino no encontrada');
      }

      nextParentId = new Types.ObjectId(cleanNewParentId);
      const targetParent = await this.folderModel.findOne({
        _id: nextParentId,
        ownerId,
        deletedAt: null,
      });

      if (!targetParent) {
        throw new NotFoundException('Carpeta destino no encontrada');
      }

      // evitar mover padres a hijos
      const isDescendant = targetParent.ancestors.some((a) =>
        a.equals(targetFolderId),
      );
      if (isDescendant) {
        throw new BadRequestException(
          'No puedes mover una carpeta dentro de uno de sus descendientes',
        );
      }

      newAncestors = [...targetParent.ancestors, targetParent._id];
    }

    // mismo nombre
    const collision = await this.folderModel.findOne({
      _id: { $ne: targetFolderId },
      ownerId,
      parentId: nextParentId,
      name: folder.name,
      deletedAt: null,
    });

    if (collision) {
      throw new ConflictException('Ya existe una carpeta con el mismo nombre en la ubicación destino');
    }

    const updatedBaseAncestors = [...newAncestors, folder._id];
    folder.parentId = nextParentId;
    folder.ancestors = newAncestors;
    await folder.save();

    const descendants = await this.folderModel.find({
      ancestors: folder._id,
      deletedAt: null,
    });

    // actualizacion de ancestors para carpetas completas
    for (const desc of descendants) {
      const idx = desc.ancestors.findIndex((a) => a.equals(folder._id));
      if (idx !== -1) {
        const childSuffix = desc.ancestors.slice(idx + 1);
        desc.ancestors = [...updatedBaseAncestors, ...childSuffix];
        await desc.save();
      }
    }

    return folder;
  }

  async rename(userId: string, folderId: string, name: string): Promise<FolderDocument> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(folderId)) {
      throw new NotFoundException('Carpeta no encontrada');
    }

    const ownerId = new Types.ObjectId(userId);
    const targetFolderId = new Types.ObjectId(folderId);

    const folder = await this.folderModel.findOne({
      _id: targetFolderId,
      ownerId,
      deletedAt: null,
    });

    if (!folder) {
      throw new NotFoundException('Carpeta no encontrada');
    }

    const collision = await this.folderModel.findOne({
      _id: { $ne: targetFolderId },
      ownerId,
      parentId: folder.parentId,
      name: name.trim(),
      deletedAt: null,
    });

    if (collision) {
      throw new ConflictException('Ya existe una carpeta con ese nombre en esta ubicación');
    }

    folder.name = name.trim();
    return folder.save();
  }

  async moveToTrash(userId: string, folderId: string): Promise<FolderDocument> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(folderId)) {
      throw new NotFoundException('Carpeta no encontrada');
    }

    const ownerId = new Types.ObjectId(userId);
    const targetFolderId = new Types.ObjectId(folderId);

    const folder = await this.folderModel.findOne({
      _id: targetFolderId,
      ownerId,
      deletedAt: null,
    });

    if (!folder) {
      throw new NotFoundException('Carpeta no encontrada');
    }

    const now = new Date();
    folder.deletedAt = new Date();
    folder.trashRootId = folder._id;
    await folder.save();

    const descendantFolders = await this.folderModel.find({
      ownerId,
      ancestors: folder._id,
      deletedAt: null,
    });

    const descendantFolderIds = descendantFolders.map((f) => f._id);

    // si existen id ancestors entonces se buscan que coinicidan en la lsita y se actualizan
    if (descendantFolderIds.length > 0) {
      await this.folderModel.updateMany(
        { _id: { $in: descendantFolderIds } },
        { $set: { deletedAt: now, trashRootId: folder._id } },
      );

    }

    // elminacion de los file de manera masiva
    const allFolderIds = [folder._id, ...descendantFolderIds];
    await this.fileModel.updateMany(
      {
        ownerId,
        folderId: { $in: allFolderIds },
        deletedAt: null,
      },
      { $set: { deletedAt: now, trashRootId: folder._id } },
    );

    return folder;
  }
}
