import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateFileDto } from './dto/file.dto.js';

@ApiBearerAuth()
@ApiTags('files')
@Controller('file')
export class FileController {
  @Post('upload')
  uploadFile(@Body() dto: CreateFileDto) {}

  @Get(':id/download')
  downloadFile(@Param('id') id: string) {}

  @Get(':id/raw')
  findRaw(@Param('id') id: string) {}

  @Patch(':id/name')
  renameFile(@Param('id') id: string) {

  }

}
