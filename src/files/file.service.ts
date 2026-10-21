import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { FileDoc, FileDocument, FileType } from './schemas/file.schema.js';
import { Folder, FolderDocument } from '../folders/schemas/folder.schema.js';
import { User, UserDocument } from '../user/schemas/user.schema.js';
import { GridFsService } from './gridfs.service.js';
import {
  Share,
  ShareDocument,
  SharePermission,
  ShareResourceType,
} from '../shares/schemas/share.schema.js';

@Injectable()
export class FileService {
  constructor(
    @InjectModel(FileDoc.name) private readonly fileModel: Model<FileDocument>,
    @InjectModel(Folder.name)
    private readonly folderModel: Model<FolderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Share.name) private readonly shareModel: Model<ShareDocument>,
    private readonly gridFsService: GridFsService,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File, // metadatos
    folderId?: string,
    rawTags?: string[] | string,
  ): Promise<FileDocument> {
    if (!file) {
      throw new BadRequestException('El archivo es requerido');
    }

    const lowerName = file.originalname.toLowerCase();
    const isTxt = lowerName.endsWith('.txt');
    const isMd = lowerName.endsWith('.md');

    if (!isTxt && !isMd) {
      throw new BadRequestException(
        'Solo se permiten archivos en formato .txt y .md',
      );
    }

    const ownerId = new Types.ObjectId(userId);
    let targetFolderId: Types.ObjectId | null = null;

    // pertenece a una carpeta y no a la raiz
    if (folderId) {
      targetFolderId = new Types.ObjectId(folderId);
      const folder = await this.folderModel.findOne({
        _id: targetFolderId,
        ownerId,
        deletedAt: null,
      });

      if (!folder) {
        throw new NotFoundException('Carpeta destino no encontrada');
      }
    }

    const existing = await this.fileModel.findOne({
      ownerId,
      folderId: targetFolderId,
      name: file.originalname,
      deletedAt: null,
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un archivo con ese nombre en esta ubicación',
      );
    }

    let tags: string[] = [];
    if (Array.isArray(rawTags)) {
      tags = rawTags.map((t) => t.trim()).filter(Boolean); // elminacion de ""
    }

    // conversion a un arreglo para mayor control
    if (typeof rawTags === 'string') {
      tags = rawTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const gridFsId = await this.gridFsService.upload(
      file.originalname,
      file.buffer,
    );
    const fileType = isMd ? FileType.Md : FileType.Txt;

    const fileDoc = await this.fileModel.create({
      name: file.originalname,
      type: fileType,
      size: file.size,
      gridFsId,
      ownerId,
      folderId: targetFolderId,
      tags,
      deletedAt: null,
      trashRootId: null,
    });

    await this.userModel.findByIdAndUpdate(ownerId, {
      $inc: { storageUsedBytes: file.size },
    });

    return fileDoc;
  }

  private async findFileWithAccess(
    userId: string,
    fileId: string,
    requiredPermission?: SharePermission,
  ): Promise<{ fileDoc: FileDocument; isOwner: boolean }> {
    const userObjId = new Types.ObjectId(userId);
    const targetFileId = new Types.ObjectId(fileId);

    const fileDoc = await this.fileModel.findOne({
      _id: targetFileId,
      deletedAt: null,
    });

    if (!fileDoc) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (fileDoc.ownerId.equals(userObjId)) {
      return { fileDoc, isOwner: true };
    }

    const share = await this.shareModel.findOne({
      resourceType: ShareResourceType.File,
      resourceId: targetFileId,
      sharedWithId: userObjId,
    });

    if (!share) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (requiredPermission === SharePermission.Edit && share.permission !== SharePermission.Edit) {
      throw new ForbiddenException('No tienes permisos de edición para este archivo');
    }

    if (
      requiredPermission === SharePermission.Comment &&
      share.permission !== SharePermission.Comment &&
      share.permission !== SharePermission.Edit
    ) {
      throw new ForbiddenException('No tienes permisos para modificar etiquetas');
    }

    return { fileDoc, isOwner: false };
  }

  async download(userId: string, fileId: string) {
    const { fileDoc } = await this.findFileWithAccess(userId, fileId);
    const stream = this.gridFsService.download(fileDoc.gridFsId);
    return { fileDoc, stream };
  }

  async getRaw(userId: string, fileId: string) {
    const { fileDoc } = await this.findFileWithAccess(userId, fileId);
    const buffer = await this.gridFsService.readToBuffer(fileDoc.gridFsId);
    return { file: fileDoc, content: buffer.toString('utf-8') };
  }

  async rename(
    userId: string,
    fileId: string,
    newName: string,
  ): Promise<FileDocument> {
    const ownerId = new Types.ObjectId(userId);
    const targetFileId = new Types.ObjectId(fileId);
    const trimmed = newName.trim();

    const fileDoc = await this.fileModel.findOne({
      _id: targetFileId,
      ownerId,
      deletedAt: null,
    });

    if (!fileDoc) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const expectedExtension = `.${fileDoc.type}`;

    if (!trimmed.toLowerCase().endsWith(expectedExtension)) {
      throw new BadRequestException(
        `El nombre del archivo debe conservar la extensión ${expectedExtension}`,
      );
    }

    const collision = await this.fileModel.findOne({
      _id: { $ne: targetFileId },
      ownerId,
      folderId: fileDoc.folderId,
      name: trimmed,
      deletedAt: null,
    });

    if (collision) {
      throw new ConflictException(
        'Ya existe un archivo con ese nombre en esta ubicación',
      );
    }

    fileDoc.name = trimmed;
    return fileDoc.save();
  }

  async move(
    userId: string,
    fileId: string,
    newFolderId?: string | null,
  ): Promise<FileDocument> {
    const ownerId = new Types.ObjectId(userId);
    const targetFileId = new Types.ObjectId(fileId);

    const fileDoc = await this.fileModel.findOne({
      _id: targetFileId,
      ownerId,
      deletedAt: null,
    });

    if (!fileDoc) {
      throw new NotFoundException('Archivo no encontrado');
    }

    let nextFolderId: Types.ObjectId | null = null;
    if (newFolderId) {
      nextFolderId = new Types.ObjectId(newFolderId);
      const folder = await this.folderModel.findOne({
        _id: nextFolderId,
        ownerId,
        deletedAt: null,
      });

      if (!folder) {
        throw new NotFoundException('Carpeta destino no encontrada');
      }
    }

    const collision = await this.fileModel.findOne({
      _id: { $ne: targetFileId },
      ownerId,
      folderId: nextFolderId,
      name: fileDoc.name,
      deletedAt: null,
    });

    if (collision) {
      throw new ConflictException(
        'Ya existe un archivo con ese nombre en la carpeta destino',
      );
    }

    fileDoc.folderId = nextFolderId;
    return fileDoc.save();
  }

  async moveToTrash(userId: string, fileId: string): Promise<FileDocument> {
    const { fileDoc } = await this.findFileWithAccess(userId, fileId, SharePermission.Edit);

    fileDoc.deletedAt = new Date();
    // asignamos su propio ID para determinar que es raiz
    fileDoc.trashRootId = fileDoc._id;

    return fileDoc.save();
  }

  async updateTags(userId: string, fileId: string, rawTags?: string[] | string): Promise<FileDocument> {
    const { fileDoc } = await this.findFileWithAccess(userId, fileId, SharePermission.Comment);

    let tags: string[] = [];
    if (Array.isArray(rawTags)) {
      tags = rawTags.map((t) => t.trim()).filter(Boolean);
    } else if (typeof rawTags === 'string') {
      tags = rawTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    fileDoc.tags = tags;
    return fileDoc.save();
  }
  async getRecent(userId: string, limit = 10): Promise<FileDocument[]> {
    const ownerId = new Types.ObjectId(userId);
    return this.fileModel
      .find({
        ownerId,
        deletedAt: null,
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
  }
}
