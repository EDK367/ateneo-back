import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from './schemas/user.schema.js';

@ApiBearerAuth()
@ApiTags('users')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.Admin)
  findAll() {
    return this.userService.findAll();
  }

  @Delete(':id')
  @Roles(Role.Admin)
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }

}
