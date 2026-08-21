import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  QrLoginDto,
  GenerateQrDto,
} from './dto/auth.dto';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return {
      success: true,
      statusCode: 201,
      message: 'Đăng ký tài khoản thành công!',
      data: user,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      statusCode: 200,
      message: 'Đăng nhập thành công!',
      data: result,
    };
  }

  @Post('qr-login')
  async qrLogin(@Body() dto: QrLoginDto) {
    const result = await this.authService.qrLogin(dto);
    return {
      success: true,
      statusCode: 200,
      message: 'Đăng nhập bằng mã QR thành công!',
      data: result,
    };
  }

  @Post('generate-qr')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  async generateQr(@Body() dto: GenerateQrDto) {
    const result = await this.authService.generateQr(dto);
    return {
      success: true,
      statusCode: 200,
      message: 'Tạo mã QR thành công!',
      data: result,
    };
  }
}
