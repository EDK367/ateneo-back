import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { FileType } from '../schemas/file.schema.js';

export class CreateFileDto {

  @ApiProperty({ example: 'mi-documento' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: FileType.Txt, enum: FileType })
  @IsEnum(FileType)
  type: FileType;

  @ApiProperty({ example: '68f123456789abcdef123456' })
  @IsOptional()
  @IsMongoId()
  folderId?: string;

  @ApiProperty({ example: ['trabajo', 'importante'] })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

}

