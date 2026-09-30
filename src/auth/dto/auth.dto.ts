import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {

    @ApiProperty({ example: 'edk367' })
    @IsString()
    @MinLength(3)
    @MaxLength(30)
    username: string;

    @ApiProperty({ example: 'admin@admin.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '12345678', minLength: 8 })
    @IsString()
    @MinLength(8)
    @MaxLength(100)
    password: string;
}

export class LoginDto {

    @ApiProperty({ example: 'edk367' })
    @IsString()
    user: string;

    @ApiProperty({ example: '12345678' })
    @IsString()
    password: string;
}