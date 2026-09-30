import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../service/auth.service.js';
import { Public } from '../decorators/public.decorator.js';
import { LoginDto, RegisterDto } from '../dto/auth.dto.js';
import { CurrentUser } from '../decorators/user.decorator.js';
import { Body, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @Get('profile')
  profile(@CurrentUser() user: { userId: string, username: string, email: string, role: string }) {
    return user;
  }

}
