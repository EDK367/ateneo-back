import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateShareDto } from './dto/shares.dto.js';

@ApiBearerAuth()
@ApiTags('shares')
@Controller('shares')
export class SharesController {

  @Post()
  shares(@Body() dto: CreateShareDto) {}

  @Delete(':id')
  deleteShare(@Param('id') id: string) {}

  @Patch(':id/authorization')
  modifiedAuthorization(@Param('id') id: string) {}

}
