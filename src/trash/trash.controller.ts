import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth()
@ApiTags('trash')
@Controller('trash')
export class TrashController {

  @Get()
  findAllTrash() {

  }

  @Post('restore/:id')
  restore(@Param('id') id: string) {}

  @Delete('purge/:id')
  delete(@Param('id') id: string) {}


}
