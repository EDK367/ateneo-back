import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateFolderDto } from './dto/folder.dto.js';

@ApiBearerAuth()
@ApiTags('folders')
@Controller('folders')
export class FolderController {

  @Post()
  create(@Body() createDto: CreateFolderDto) {

  }

  @Get('content')
  findContent() {

  }

  @Patch(':id')
  moveFolder(@Param('id') id: string) { }

}
