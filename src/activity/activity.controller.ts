import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';

@ApiBearerAuth()
@ApiTags('activity')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener historial de actividad reciente del usuario' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@CurrentUser() user: any, @Query('limit') limit?: number) {
    return this.activityService.findAll(user.userId, limit ? Number(limit) : 20);
  }
}
