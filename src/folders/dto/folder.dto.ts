import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ example: 'Mi Carpeta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @MinLength(1)
  name: string;

  @ApiProperty({ example: '68f123456789abcdef123456', required: false })
  @IsOptional()
  @IsMongoId()
  parentId?: string;
}

export class MoveFolderDto {
  @ApiProperty({ example: '68f123456789abcdef123456', required: false, nullable: true })
  @IsOptional()
  @IsMongoId()
  newParentId?: string | null;
}

export class RenameFolderDto {
  @ApiProperty({ example: 'Nuevo Nombre' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @MinLength(1)
  name: string;
}