import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../user/schemas/user.schema.js';

@ApiBearerAuth()
@ApiTags('reports')
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas del dashboard del usuario' })
  getDashboardStats(@CurrentUser() user: any) {
    return this.reportService.getDashboardStats(user.userId);
  }

  @Get('global')
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Obtener estadísticas globales del sistema' })
  getGlobalStats() {
    return this.reportService.getGlobalStats();
  }

  @Get('by-type')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Cantidad de archivos agrupados por tipo' })
  getFilesByType() {
    return this.reportService.getFilesByType();
  }

  @Get('by-date-range')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Archivos almacenados dentro de un rango de fechas' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getFilesByDateRange(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getFilesByDateRange(startDate, endDate);
  }

  @Get('most-active-files')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Archivos con mayor cantidad de operaciones registradas' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFilesMostOperations(@Query('limit') limit?: number) {
    return this.reportService.getFilesMostOperations(limit ? Number(limit) : 10);
  }

  @Get('top-users-files')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Top 10 usuarios con mayor cantidad de archivos' })
  getTopUsersWithMostFiles() {
    return this.reportService.getTopUsersWithMostFiles();
  }

  @Get('top-users-shares')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Usuarios con mayor cantidad de recursos compartidos' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopUsersWithMostShares(@Query('limit') limit?: number) {
    return this.reportService.getTopUsersWithMostShares(limit ? Number(limit) : 10);
  }

  @Get('shared-by-user/:userId')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Recursos compartidos por un usuario seleccionado' })
  getResourcesSharedByUser(@Param('userId') userId: string) {
    return this.reportService.getResourcesSharedByUser(userId);
  }

  @Get('shared-with-user/:userId')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Recursos recibidos por un usuario seleccionado' })
  getResourcesReceivedByUser(@Param('userId') userId: string) {
    return this.reportService.getResourcesReceivedByUser(userId);
  }

  @Get('never-shared')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Archivos que nunca han sido compartidos' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getNeverSharedFiles(@Query('limit') limit?: number) {
    return this.reportService.getNeverSharedFiles(limit ? Number(limit) : 50);
  }

  @Get('folders-most-files')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Carpetas con mayor cantidad de archivos' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFoldersWithMostFiles(@Query('limit') limit?: number) {
    return this.reportService.getFoldersWithMostFiles(limit ? Number(limit) : 10);
  }

  @Get('files-most-shared-users')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Archivos compartidos con mayor cantidad de usuarios' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFilesSharedWithMostUsers(@Query('limit') limit?: number) {
    return this.reportService.getFilesSharedWithMostUsers(limit ? Number(limit) : 10);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener resumen general de reportes' })
  getDefaultStats(@CurrentUser() user: any) {
    return this.reportService.getDashboardStats(user.userId);
  }
}
