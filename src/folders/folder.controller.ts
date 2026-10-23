import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FolderService } from './folder.service.js';
import {
  CreateFolderDto,
  MoveFolderDto,
  RenameFolderDto,
} from './dto/folder.dto.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';

@ApiBearerAuth()
@ApiTags('folders')
@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva carpeta' })
  create(@CurrentUser() user: any, @Body() dto: CreateFolderDto) {
    return this.folderService.create(user.userId, dto);
  }

  @Get('content')
  @ApiOperation({ summary: 'Obtener contenido de una carpeta o de la raíz' })
  @ApiQuery({ name: 'folderId', required: false, type: String })
  findContent(@CurrentUser() user: any, @Query('folderId') folderId?: string) {
    return this.folderService.getContent(user.userId, folderId, user.role);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Mover una carpeta a otro destino' })
  moveFolder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: MoveFolderDto,
  ) {
    return this.folderService.move(user.userId, id, dto.newParentId);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Renombrar una carpeta' })
  renameFolder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RenameFolderDto,
  ) {
    return this.folderService.rename(user.userId, id, dto.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mover una carpeta a la papelera' })
  deleteFolder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.folderService.moveToTrash(user.userId, id);
  }
}
