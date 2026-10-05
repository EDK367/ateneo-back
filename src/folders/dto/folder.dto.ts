import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Types } from 'mongoose';

export class CreateFolderDto {
  @ApiProperty({ example: 'Mi Carpeta' })
  @IsString()
  @MaxLength(100)
  @MinLength(1)
  name: string;

  @ApiProperty({ example: '68f123456789abcdef123456' })
  @IsString()
  @IsOptional()
  @IsMongoId()
  parenId?: string;
}