import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path theo dự án của bạn
import { RegisterDto, LoginDto, QrLoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Kiểm tra userName đã tồn tại chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { userName: dto.userName },
    });
    if (existingUser) {
      throw new BadRequestException('Tên đăng nhập đã tồn tại!');
    }

    // 2. Hash mật khẩu
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. Tạo user mới
    const user = await this.prisma.user.create({
      data: {
        userName: dto.userName,
        password: hashedPassword,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        role: dto.role,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  async qrLogin(dto: QrLoginDto) {
    // 1. Tìm phòng theo roomNumber
    const room = await this.prisma.room.findFirst({
      where: { roomNumber: dto.roomCode },
    });
    if (!room) {
      throw new UnauthorizedException('Mã QR không hợp lệ!');
    }

    // 2. Tìm hợp đồng đang hoạt động của phòng, có liên kết user
    const contract = await this.prisma.contract.findFirst({
      where: { roomId: room.id, isActive: true, userId: { not: null } },
    });
    if (!contract || !contract.userId) {
      throw new UnauthorizedException(
        'Phòng này chưa có tài khoản người thuê!',
      );
    }

    // 3. Lấy user
    const user = await this.prisma.user.findUnique({
      where: { id: contract.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa!',
      );
    }

    // 4. Tạo JWT (reuse payload giống login)
    const payload = { sub: user.id, userName: user.userName, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        userName: user.userName,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto) {
    // 1. Tìm user
    const user = await this.prisma.user.findUnique({
      where: { userName: dto.userName },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác!',
      );
    }

    // 2. So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác!',
      );
    }

    // 3. Tạo JWT Token
    const payload = { sub: user.id, userName: user.userName, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        userName: user.userName,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
