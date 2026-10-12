import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FileType } from '../schemas/file.schema.js';

export class CreateFileDto {

  @ApiProperty({ example: 'mi-documento.txt' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: FileType.Txt, enum: FileType })
  @IsEnum(FileType)
  type: FileType;

  @ApiProperty({ example: '68f123456789abcdef123456', required: false })
  @IsOptional()
  @IsMongoId()
  folderId?: string;

  @ApiProperty({ example: ['trabajo', 'importante'], required: false })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

}

export class UploadFileDto {

  @ApiProperty({ example: '68f123456789abcdef123456', required: false })
  @IsOptional()
  @IsMongoId()
  folderId?: string;

  @ApiProperty({ example: ['general'], required: false })
  @IsOptional()
  tags?: string[] | string;

}

export class RenameFileDto {

  @ApiProperty({ example: 'nuevo-nombre.md' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}

export class MoveFileDto {

  @ApiProperty({ example: '68f123456789abcdef123456', required: false, nullable: true })
  @IsOptional()
  @IsMongoId()
  folderId?: string | null;

}
