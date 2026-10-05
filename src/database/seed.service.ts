import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { Role, User, UserDocument } from '../user/schemas/user.schema.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_ON_BOOT === 'true') {
      await this.seed();
    }
  }

  async seed() {
    await this.seedAdmin();
    await this.seedUser1();
    await this.seedUser2();
  }

  private async seedAdmin() {
    const username = 'admin';
    const email = 'admin@ateneo.com'.toLowerCase();
    const password =
      '$2b$10$uTWCuPAV0Hn9F6O3v.MXSOLI8D4XsVYNpFzzka5ngctZnUI5paMN2';

    const exists = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (exists) {
      this.logger.log(
        `Este usuario ya existe: ${exists.username} (${exists.email})`,
      );
      return;
    }

    const admin = await this.userModel.create({
      username,
      email,
      password,
      role: Role.Admin,
      isActive: true,
      storageUsedBytes: 0,
    });

    this.logger.log(`Usuario creado: ${admin.username} (${admin.email})`);
  }

  private async seedUser1() {
    const username = 'edk';
    const email = 'edk@ateneo.com'.toLowerCase();
    const password =
      '$2b$10$uTWCuPAV0Hn9F6O3v.MXSOLI8D4XsVYNpFzzka5ngctZnUI5paMN2';

    const exists = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (exists) {
      this.logger.log(
        `Este usuario ya existe: ${exists.username} (${exists.email})`,
      );
      return;
    }


    const user = await this.userModel.create({
      username,
      email,
      password,
      role: Role.User,
      isActive: true,
      storageUsedBytes: 0,
    });

    this.logger.log(`Usuario creado: ${user.username} (${user.email})`);
  }

  private async seedUser2() {
    const username = 'user';
    const email = 'user@ateneo.com'.toLowerCase();
    const password =
      '$2b$10$uTWCuPAV0Hn9F6O3v.MXSOLI8D4XsVYNpFzzka5ngctZnUI5paMN2';

    const exists = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (exists) {
      this.logger.log(
        `Este usuario ya existe: ${exists.username} (${exists.email})`,
      );
      return;
    }
    const user = await this.userModel.create({
      username,
      email,
      password,
      role: Role.User,
      isActive: true,
      storageUsedBytes: 0,
    });

    this.logger.log(`Usuario creado: ${user.username} (${user.email})`);
  }
}
