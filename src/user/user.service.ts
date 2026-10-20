import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { Role, User, UserDocument } from './schemas/user.schema.js';
import { CreateUserAdminDto, UpdateUserAdminDto } from './dto/user.dto.js';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async create(dto: CreateUserAdminDto): Promise<UserDocument> {
    const existsEmail = await this.userModel.exists({ email: dto.email.toLowerCase().trim() });
    const existsUsername = await this.userModel.exists({ username: dto.username.trim() });
    if (existsEmail || existsUsername) {
      throw new ConflictException('El correo o el username ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userModel.create({
      username: dto.username.trim(),
      email: dto.email.toLowerCase().trim(),
      password: passwordHash,
      role: dto.role || Role.User,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserAdminDto): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('+password');
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.username && dto.username.trim() !== user.username) {
      const existsUsername = await this.userModel.exists({
        username: dto.username.trim(),
        _id: { $ne: id },
      });
      if (existsUsername) {
        throw new ConflictException('El nombre de usuario ya está registrado');
      }
      user.username = dto.username.trim();
    }

    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const existsEmail = await this.userModel.exists({
        email: dto.email.toLowerCase().trim(),
        _id: { $ne: id },
      });
      if (existsEmail) {
        throw new ConflictException('El correo ya está registrado');
      }
      user.email = dto.email.toLowerCase().trim();
    }

    if (dto.role !== undefined) {
      user.role = dto.role;
    }

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }

    if (dto.password && dto.password.trim().length > 0) {
      user.password = await bcrypt.hash(dto.password.trim(), 10);
    }

    await user.save();
    return user;
  }

  async delete(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);

    if (!user || !user.isActive) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.isActive = false;

    await user.save();

    return user;
  }
}
