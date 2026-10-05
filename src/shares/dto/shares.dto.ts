import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';

import { SharePermission, ShareResourceType } from '../schemas/share.schema.js';

export class CreateShareDto {
  @ApiProperty({ example: ShareResourceType.File, enum: ShareResourceType })
  @IsEnum(ShareResourceType)
  resourceType: ShareResourceType;

  @ApiProperty({ example: '68f123456789abcdef123456' })
  @IsMongoId()
  resourceId: string;

  @ApiProperty({ example: '68f987654321abcdef654321' })
  @IsMongoId()
  sharedWithId: string;

  @ApiProperty({ example: SharePermission.Read, enum: SharePermission })
  @IsEnum(SharePermission)
  permission: SharePermission;

}
