import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrashService } from './trash.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';

@ApiBearerAuth()
@ApiTags('trash')
@Controller('trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @ApiOperation({ summary: 'Listar elementos en la papelera' })
  findAllTrash(@CurrentUser() user: any) {
    return this.trashService.findAll(user.userId);
  }

  @Post('restore/:id')
  @ApiOperation({ summary: 'Restaurar elemento de la papelera' })
  restore(@CurrentUser() user: any, @Param('id') id: string) {
    return this.trashService.restore(user.userId, id);
  }

  @Delete('empty')
  @ApiOperation({ summary: 'Vaciar la papelera' })
  emptyTrash(@CurrentUser() user: any) {
    return this.trashService.emptyTrash(user.userId);
  }

  @Delete('purge/:id')
  @ApiOperation({ summary: 'Eliminar definitivamente un elemento de la papelera' })
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.trashService.purge(user.userId, id);
  }
}
