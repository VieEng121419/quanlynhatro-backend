import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

// 1. Khai báo Interface cho User Payload gắn trong Request
export interface UserPayload {
  id: number;
  userName: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

// 2. Khai báo Interface cho Request
interface RequestWithUser {
  user?: UserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    // 3. Ép kiểu cho getRequest()
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) return null;

    // Trả về 1 trường cụ thể (ví dụ: @CurrentUser('id')) hoặc toàn bộ object user
    return data ? user[data] : user;
  },
);
