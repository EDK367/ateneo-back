import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async delete(id: string): Promise<UserDocument> {

    const user = await this.userModel.findById(id);

    if (!user || !user.isActive ) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.isActive = false;

    await user.save();

    return user;
  }
}
