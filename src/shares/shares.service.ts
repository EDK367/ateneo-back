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
import {
  Share,
  ShareDocument,
  SharePermission,
  ShareResourceType,
} from './schemas/share.schema.js';
import { FileDoc, FileDocument } from '../files/schemas/file.schema.js';
import { Folder, FolderDocument } from '../folders/schemas/folder.schema.js';
import { User, UserDocument } from '../user/schemas/user.schema.js';
import { CreateShareDto } from './dto/shares.dto.js';

@Injectable()
export class SharesService {
  constructor(
    @InjectModel(Share.name)
    private readonly shareModel: Model<ShareDocument>,
    @InjectModel(FileDoc.name)
    private readonly fileModel: Model<FileDocument>,
    @InjectModel(Folder.name)
    private readonly folderModel: Model<FolderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(userId: string, dto: CreateShareDto): Promise<ShareDocument> {
    if (!Types.ObjectId.isValid(dto.resourceId) || !Types.ObjectId.isValid(dto.sharedWithId)) {
      throw new BadRequestException('ID inválido');
    }

    const ownerId = new Types.ObjectId(userId);
    const sharedWithId = new Types.ObjectId(dto.sharedWithId);
    const resourceId = new Types.ObjectId(dto.resourceId);

    if (ownerId.equals(sharedWithId)) {
      throw new BadRequestException('No puedes compartir un recurso contigo mismo');
    }

    const recipient = await this.userModel.findOne({
      _id: sharedWithId,
      isActive: true,
    });

    if (!recipient) {
      throw new NotFoundException('Usuario destinatario no encontrado');
    }

    if (dto.resourceType === ShareResourceType.File) {
      const file = await this.fileModel.findOne({
        _id: resourceId,
        ownerId,
        deletedAt: null,
      });

      if (!file) {
        throw new NotFoundException('Archivo no encontrado');
      }
    } else if (dto.resourceType === ShareResourceType.Folder) {
      const folder = await this.folderModel.findOne({
        _id: resourceId,
        ownerId,
        deletedAt: null,
      });

      if (!folder) {
        throw new NotFoundException('Carpeta no encontrada');
      }
    } else {
      throw new BadRequestException('Tipo de recurso inválido');
    }

    const existing = await this.shareModel.findOne({
      resourceType: dto.resourceType,
      resourceId,
      sharedWithId,
    });

    if (existing) {
      throw new ConflictException('Este recurso ya ha sido compartido con este usuario');
    }

    return this.shareModel.create({
      resourceType: dto.resourceType,
      resourceId,
      ownerId,
      sharedWithId,
      permission: dto.permission,
    });
  }

  async findSharedWithMe(userId: string) {
    const sharedWithId = new Types.ObjectId(userId);

    const shares = await this.shareModel
      .find({ sharedWithId })
      .populate('ownerId', 'username email')
      .sort({ createdAt: -1 })
      .exec();

    return this.attachResources(shares);
  }

  async findSharedByMe(userId: string) {
    const ownerId = new Types.ObjectId(userId);

    const shares = await this.shareModel
      .find({ ownerId })
      .populate('sharedWithId', 'username email')
      .sort({ createdAt: -1 })
      .exec();

    return this.attachResources(shares);
  }

  async findAll(userId: string) {
    const [sharedWithMe, sharedByMe] = await Promise.all([
      this.findSharedWithMe(userId),
      this.findSharedByMe(userId),
    ]);

    return {
      sharedWithMe,
      sharedByMe,
    };
  }

  async findById(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }

    const userObjId = new Types.ObjectId(userId);
    const shareId = new Types.ObjectId(id);

    const share = await this.shareModel
      .findOne({
        _id: shareId,
        $or: [{ ownerId: userObjId }, { sharedWithId: userObjId }],
      })
      .populate('ownerId', 'username email')
      .populate('sharedWithId', 'username email')
      .exec();

    if (!share) {
      throw new NotFoundException('Recurso compartido no encontrado');
    }

    const [enriched] = await this.attachResources([share]);
    return enriched;
  }

  async updatePermission(
    userId: string,
    shareId: string,
    permission: SharePermission,
  ): Promise<ShareDocument> {
    if (!Types.ObjectId.isValid(shareId)) {
      throw new BadRequestException('ID inválido');
    }

    const ownerId = new Types.ObjectId(userId);
    const targetShareId = new Types.ObjectId(shareId);

    const share = await this.shareModel.findById(targetShareId);

    if (!share) {
      throw new NotFoundException('Recurso compartido no encontrado');
    }

    if (!share.ownerId.equals(ownerId)) {
      throw new ForbiddenException('Solo el propietario puede modificar los permisos');
    }

    share.permission = permission;
    return share.save();
  }

  async delete(userId: string, shareId: string) {
    if (!Types.ObjectId.isValid(shareId)) {
      throw new BadRequestException('ID inválido');
    }

    const userObjId = new Types.ObjectId(userId);
    const targetShareId = new Types.ObjectId(shareId);

    const share = await this.shareModel.findById(targetShareId);

    if (!share) {
      throw new NotFoundException('Recurso compartido no encontrado');
    }

    const isOwner = share.ownerId.equals(userObjId);
    const isRecipient = share.sharedWithId.equals(userObjId);

    if (!isOwner && !isRecipient) {
      throw new ForbiddenException('No tienes permisos para eliminar este recurso compartido');
    }

    await this.shareModel.findByIdAndDelete(targetShareId);

    return { message: 'Recurso compartido eliminado exitosamente' };
  }

  private async attachResources(shares: ShareDocument[]) {
    if (!shares.length) {
      return [];
    }

    const fileIds = shares
      .filter((s) => s.resourceType === ShareResourceType.File)
      .map((s) => s.resourceId);

    const folderIds = shares
      .filter((s) => s.resourceType === ShareResourceType.Folder)
      .map((s) => s.resourceId);

    const [files, folders] = await Promise.all([
      this.fileModel.find({ _id: { $in: fileIds }, deletedAt: null }).exec(),
      this.folderModel.find({ _id: { $in: folderIds }, deletedAt: null }).exec(),
    ]);

    const fileMap = new Map(files.map((f) => [f._id.toString(), f]));
    const folderMap = new Map(folders.map((f) => [f._id.toString(), f]));

    return shares
      .map((share) => {
        const resource =
          share.resourceType === ShareResourceType.File
            ? fileMap.get(share.resourceId.toString())
            : folderMap.get(share.resourceId.toString());

        if (!resource) {
          return null;
        }

        return Object.assign(share.toObject(), { resource });
      })
      .filter(Boolean);
  }
}
