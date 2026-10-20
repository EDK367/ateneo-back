import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateShareDto, UpdateShareDto } from './dto/shares.dto.js';
import { SharesService } from './shares.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';

@ApiBearerAuth()
@ApiTags('shares')
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  @ApiOperation({ summary: 'Compartir un recurso' })
  shares(@CurrentUser() user: any, @Body() dto: CreateShareDto) {
    return this.sharesService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los recursos compartidos' })
  findAll(@CurrentUser() user: any) {
    return this.sharesService.findAll(user.userId, user.role);
  }

  @Get('shared-with-me')
  @ApiOperation({ summary: 'Listar recursos compartidos conmigo' })
  findSharedWithMe(@CurrentUser() user: any) {
    return this.sharesService.findSharedWithMe(user.userId);
  }

  @Get('shared-by-me')
  @ApiOperation({ summary: 'Listar recursos compartidos por mí' })
  findSharedByMe(@CurrentUser() user: any) {
    return this.sharesService.findSharedByMe(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un recurso compartido por ID' })
  findById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.sharesService.findById(user.userId, id);
  }

  @Patch(':id/authorization')
  @ApiOperation({ summary: 'Modificar permisos de un recurso compartido' })
  modifiedAuthorization(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateShareDto,
  ) {
    return this.sharesService.updatePermission(user.userId, id, dto.permission, user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un recurso compartido' })
  deleteShare(@CurrentUser() user: any, @Param('id') id: string) {
    return this.sharesService.delete(user.userId, id, user.role);
  }
}
