import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// 1. Khai báo interface cho Authenticated Request
interface RequestWithUser {
  user?: {
    id: number;
    userName: string;
    role: Role;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    Logger.log(`Required roles: ${requiredRoles.join(', ')}`);

    if (!requiredRoles) {
      return true;
    }

    // 2. Ép kiểu cho kết quả của getRequest()
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Bạn chưa đăng nhập!');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này!',
      );
    }

    return true;
  }
}
