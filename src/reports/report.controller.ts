import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';

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

  @Get()
  @ApiOperation({ summary: 'Obtener resumen general de reportes' })
  getDefaultStats(@CurrentUser() user: any) {
    return this.reportService.getDashboardStats(user.userId);
  }
}
