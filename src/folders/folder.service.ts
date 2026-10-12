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

@Injectable()
export class FolderService {

  constructor(
    @InjectModel(Folder.name) private readonly folderModel: Model<FolderDocument>,
    @InjectModel(FileDoc.name) private readonly fileModel: Model<FileDocument>,
  ) {}

  async create(userId: string, dto: CreateFolderDto): Promise<FolderDocument> {

    const ownerId = new Types.ObjectId(userId);
    let parentId: Types.ObjectId | null = null;
    let ancestors: Types.ObjectId[] = [];

    if (dto.parentId) {
      // si se crea dentro de otro folder lo buscamos y verificamos que no este eliminado
      parentId = new Types.ObjectId(dto.parentId);
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

  async getContent(userId: string, folderId?: string) {

    const ownerId = new Types.ObjectId(userId);
    let currentFolder: FolderDocument | null = null;
    const parentId = folderId ? new Types.ObjectId(folderId) : null;

    if (parentId) {
      currentFolder = await this.folderModel.findOne({
        _id: parentId,
        ownerId,
        deletedAt: null,
      });

      if (!currentFolder) {
        throw new NotFoundException('Carpeta no encontrada');
      }
    }

    const folders = await this.folderModel
      .find({
        ownerId,
        parentId,
        deletedAt: null,
      })
      .sort({ name: 1 })
      .exec();

    const files = await this.fileModel
      .find({
        ownerId,
        folderId: parentId,
        deletedAt: null,
      })
      .sort({ name: 1 })
      .exec();

    return {
      currentFolder,
      folders,
      files,
    };
  }

  async move(userId: string, folderId: string, newParentId?: string | null): Promise<FolderDocument> {

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

    if (newParentId) {
      // evitar movimiento circular
      if (folderId === newParentId) {
        throw new BadRequestException(
          'No puedes mover una carpeta dentro de sí misma',
        );
      }

      nextParentId = new Types.ObjectId(newParentId);
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
}
