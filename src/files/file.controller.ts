import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FileService } from './file.service.js';
import {
  MoveFileDto,
  RenameFileDto,
  UploadFileDto,
} from './dto/file.dto.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';

@ApiBearerAuth()
@ApiTags('files')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Subir archivo .txt o .md a GridFS' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folderId: { type: 'string', nullable: true },
        tags: { type: 'string', nullable: true },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    return this.fileService.upload(user.userId, file, dto.folderId, dto.tags);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Descargar archivo como stream directo desde GridFS' })
  async downloadFile(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fileDoc, stream } = await this.fileService.download(user.userId, id);
    const contentType =
      fileDoc.type === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileDoc.name)}"`,
    });

    return new StreamableFile(stream);
  }

  @Get(':id/raw')
  @ApiOperation({ summary: 'Obtener contenido de texto del archivo para previsualización' })
  findRaw(@CurrentUser() user: any, @Param('id') id: string) {
    return this.fileService.getRaw(user.userId, id);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Renombrar archivo' })
  renameFile(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RenameFileDto,
  ) {
    return this.fileService.rename(user.userId, id, dto.name);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Mover archivo a otra carpeta' })
  moveFile(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: MoveFileDto,
  ) {
    return this.fileService.move(user.userId, id, dto.folderId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mover un archivo a la papelera' })
  deleteFile(@CurrentUser() user: any, @Param('id') id: string) {
    return this.fileService.moveToTrash(user.userId, id);
  }
}
