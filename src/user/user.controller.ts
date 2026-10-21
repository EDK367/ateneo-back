import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from './schemas/user.schema.js';
import { CreateUserAdminDto, UpdateUserAdminDto } from './dto/user.dto.js';

@ApiBearerAuth()
@ApiTags('users')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  findAll() {
    return this.userService.findAll();
  }

  @Post()
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Crear usuario directamente como administrador' })
  create(@Body() dto: CreateUserAdminDto) {
    return this.userService.create(dto);
  }

  @Put(':id')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.userService.update(id, dto);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Actualizar parcialmente usuario' })
  patch(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Desactivar usuario (soft delete)' })
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
