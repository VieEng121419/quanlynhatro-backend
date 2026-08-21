import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path theo dự án của bạn
import {
  RegisterDto,
  LoginDto,
  QrLoginDto,
  GenerateQrDto,
} from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { generateQrCode, verifyQrCode } from '../common/utils/qr.util';

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
    // 1. Verify mã QR (HMAC)
    const decoded = verifyQrCode(dto.qrCode);
    if (!decoded) {
      throw new UnauthorizedException('Mã QR không hợp lệ!');
    }
    const { roomId, userId } = decoded;

    // 2. Tìm hợp đồng đang hoạt động giữa phòng và user
    const contract = await this.prisma.contract.findFirst({
      where: { roomId, userId, isActive: true },
    });
    if (!contract) {
      throw new UnauthorizedException(
        'Phòng này chưa có tài khoản người thuê!',
      );
    }

    // 3. Lấy user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

  async generateQr(dto: GenerateQrDto) {
    const { roomId, userId } = dto;

    // 1. Kiểm tra phòng tồn tại
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new BadRequestException('Phòng không tồn tại!');
    }

    // 2. Kiểm tra user tồn tại
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại!');
    }

    // 3. Kiểm tra hợp đồng active giữa phòng và user
    const contract = await this.prisma.contract.findFirst({
      where: { roomId, userId, isActive: true },
    });
    if (!contract) {
      throw new BadRequestException(
        'Không có hợp đồng đang hoạt động giữa phòng và người dùng này!',
      );
    }

    // 4. Tạo chuỗi QR code (HMAC)
    const qrCode = generateQrCode(roomId, userId);

    // 5. Tạo hình QR (PNG data URL)
    const qrImage = await QRCode.toDataURL(qrCode);

    return {
      qrCode,
      qrImage,
      room: {
        id: room.id,
        roomNumber: room.roomNumber,
      },
      user: {
        id: user.id,
        userName: user.userName,
        fullName: user.fullName,
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
