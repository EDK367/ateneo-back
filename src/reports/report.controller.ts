import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({ summary: 'Obtener resumen general de reportes' })
  getDefaultStats(@CurrentUser() user: any) {
    return this.reportService.getDashboardStats(user.userId);
  }
}
