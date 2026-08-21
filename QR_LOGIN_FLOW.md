# QR Login Flow — Tài liệu kỹ thuật

> Tài liệu mô tả luồng đăng nhập bằng QR code cho tenant, cách hoạt động, bảo mật và các API liên quan.

## 1. Mục đích

Cho phép **tenant** đăng nhập nhanh vào ứng dụng bằng cách **quét QR code** dán trên cửa phòng của họ, thay vì phải nhập tài khoản/mật khẩu thủ công.

## 2. Ý tưởng cốt lõi

QR code chứa chuỗi được **ký bằng HMAC-SHA256** từ `roomId` và `userId`:

```
qrCode = "roomId:userId:hmac"
```

- `roomId:userId` → để server biết cần verify phòng/user nào
- `hmac` → chữ ký số, đảm bảo QR không bị giả mạo

**Vì sao không dùng `roomNumber`?**
- `roomNumber` dễ đoán (101, 102, 201...) → ai cũng tự tạo QR giả được
- `roomNumber` không unique toàn hệ thống → 2 chi nhánh có thể trùng phòng
- `roomId` + `userId` là số tuần tự, nhưng được bọc HMAC nên không thể đoán ngược

## 3. Kiến trúc

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Frontend   │         │  Backend (NestJS)│         │   Database   │
│  (Admin)    │         │                  │         │   (MySQL)    │
└──────┬──────┘         └────────┬─────────┘         └──────┬───────┘
       │  POST /auth/generate-qr │                           │
       │  (roomId, userId)       │                           │
       ├────────────────────────►│                           │
       │                         │  Kiểm tra phòng/user/     │
       │                         │  hợp đồng active          │
       │                         ├──────────────────────────►│
       │                         │◄──────────────────────────┤
       │                         │  Tạo qrCode (HMAC)        │
       │                         │  Tạo qrImage (PNG)        │
       │  { qrCode, qrImage }    │                           │
       │◄────────────────────────┤                           │
       │                         │                           │
       │  In/dán QR lên cửa      │                           │
       │                         │                           │
┌──────┴──────┐                  │                           │
│  Tenant     │                  │                           │
│  (scan QR)  │                  │                           │
└──────┬──────┘                  │                           │
       │  POST /auth/qr-login    │                           │
       │  (qrCode)               │                           │
       ├────────────────────────►│                           │
       │                         │  Verify HMAC              │
       │                         │  Tìm hợp đồng active      │
       │                         ├──────────────────────────►│
       │                         │◄──────────────────────────┤
       │                         │  Tạo JWT                  │
       │  { accessToken, user }  │                           │
       │◄────────────────────────┤                           │
       │                         │                           │
```

## 4. Các API

### 4.1. Tạo QR code (chỉ ADMIN/STAFF)

```
POST /auth/generate-qr
Authorization: Bearer <JWT>
```

**Body:**
```json
{
  "roomId": 5,
  "userId": 12
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tạo mã QR thành công!",
  "data": {
    "qrCode": "5:12:a1b2c3d4...",
    "qrImage": "data:image/png;base64,iVBORw0KGgo...",
    "room": { "id": 5, "roomNumber": "101" },
    "user": { "id": 12, "userName": "tenant01", "fullName": "Nguyễn Văn A" }
  }
}
```

**Điều kiện:**
- Phòng phải tồn tại
- User phải tồn tại
- Phải có hợp đồng **active** giữa phòng và user

### 4.2. Đăng nhập bằng QR (public)

```
POST /auth/qr-login
```

**Body:**
```json
{
  "qrCode": "5:12:a1b2c3d4..."
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đăng nhập bằng mã QR thành công!",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 12,
      "userName": "tenant01",
      "fullName": "Nguyễn Văn A",
      "role": "TENANT"
    }
  }
}
```

## 5. Chi tiết kỹ thuật

### 5.1. File `src/common/utils/qr.util.ts`

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.QR_SECRET || 'default-qr-secret-change-me';

export interface QrPayload {
  roomId: number;
  userId: number;
}

// Tạo QR: "roomId:userId:hmac"
export function generateQrCode(roomId: number, userId: number): string {
  const data = `${roomId}:${userId}`;
  const hmac = createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}:${hmac}`;
}

// Verify QR: trả { roomId, userId } nếu hợp lệ, null nếu không
export function verifyQrCode(qrCode: string): QrPayload | null {
  const parts = qrCode.split(':');
  if (parts.length !== 3) return null;

  const [roomIdStr, userIdStr, hmac] = parts;
  const data = `${roomIdStr}:${userIdStr}`;
  const expected = createHmac('sha256', SECRET).update(data).digest('hex');

  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const roomId = Number(roomIdStr);
  const userId = Number(userIdStr);
  if (!Number.isInteger(roomId) || !Number.isInteger(userId)) return null;

  return { roomId, userId };
}
```

### 5.2. Giải thích `verifyQrCode` từng dòng

| Dòng | Mô tả |
|------|-------|
| `qrCode.split(':')` | Tách chuỗi QR thành mảng `["5", "12", "hmac"]` |
| `parts.length !== 3` | Kiểm tra format đúng 3 phần |
| `const [roomIdStr, userIdStr, hmac] = parts` | Lấy 3 thành phần |
| `const data = \`${roomIdStr}:${userIdStr}\`` | Ghép lại dữ liệu gốc `"5:12"` |
| `createHmac('sha256', SECRET).update(data).digest('hex')` | Tính lại HMAC từ dữ liệu + secret |
| `Buffer.from(hmac)` / `Buffer.from(expected)` | Chuyển 2 chữ ký sang dạng byte |
| `timingSafeEqual(a, b)` | So sánh an toàn, chống timing attack |
| `Number(roomIdStr)` | Chuyển string → số |
| `Number.isInteger(...)` | Kiểm tra số nguyên hợp lệ |

### 5.3. File `src/auth/auth.service.ts` — `qrLogin`

```typescript
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
    throw new UnauthorizedException('Phòng này chưa có tài khoản người thuê!');
  }

  // 3. Lấy user
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa!');
  }

  // 4. Tạo JWT
  const payload = { sub: user.id, userName: user.userName, role: user.role };
  const accessToken = await this.jwtService.signAsync(payload);

  return {
    accessToken,
    user: { id: user.id, userName: user.userName, fullName: user.fullName, role: user.role },
  };
}
```

### 5.4. File `src/auth/auth.service.ts` — `generateQr`

```typescript
async generateQr(dto: GenerateQrDto) {
  const { roomId, userId } = dto;

  // 1. Kiểm tra phòng tồn tại
  const room = await this.prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new BadRequestException('Phòng không tồn tại!');

  // 2. Kiểm tra user tồn tại
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BadRequestException('Người dùng không tồn tại!');

  // 3. Kiểm tra hợp đồng active
  const contract = await this.prisma.contract.findFirst({
    where: { roomId, userId, isActive: true },
  });
  if (!contract) {
    throw new BadRequestException('Không có hợp đồng đang hoạt động giữa phòng và người dùng này!');
  }

  // 4. Tạo chuỗi QR code (HMAC)
  const qrCode = generateQrCode(roomId, userId);

  // 5. Tạo hình QR (PNG data URL)
  const qrImage = await QRCode.toDataURL(qrCode);

  return { qrCode, qrImage, room: { id: room.id, roomNumber: room.roomNumber }, user: { id: user.id, userName: user.userName, fullName: user.fullName } };
}
```

## 6. Bảo mật

| Biện pháp | Mô tả |
|-----------|-------|
| **HMAC-SHA256** | QR được ký bằng secret → không thể giả mạo nếu không biết secret |
| **`QR_SECRET` trong `.env`** | Secret không hardcode, đặt trong env |
| **`timingSafeEqual`** | Chống timing attack khi so sánh chữ ký |
| **Kiểm tra hợp đồng active** | Tenant cũ hết hợp đồng → không vào được dù QR còn trên cửa |
| **`generate-qr` chỉ ADMIN/STAFF** | Chỉ người có quyền mới tạo được QR |
| **`Number.isInteger`** | Chống dữ liệu rác lọt vào query DB |

## 7. Cấu hình

Thêm vào `.env`:

```
QR_SECRET="quanlynhatro-qr-secret-2026-change-me-in-production"
```

> ⚠️ **Quan trọng:** Đổi `QR_SECRET` thành chuỗi ngẫu nhiên dài trước khi deploy production. Nếu đổi secret, **tất cả QR cũ sẽ không còn hoạt động**.

## 8. Package cần cài

```bash
npm install qrcode
npm install -D @types/qrcode
```

## 8.1. Deploy `QR_SECRET` lên production

### Các file cần sửa trong repo

**`docker-compose.prod.yml`** — thêm `QR_SECRET` vào environment của backend:
```yaml
environment:
  ...
  JWT_SECRET: ${JWT_SECRET}
  QR_SECRET: ${QR_SECRET}   # ← thêm dòng này
```

**`deploy/setup-droplet.sh`** — thêm `QR_SECRET` vào file `.env` mẫu:
```bash
# ===== CẤU HÌNH BACKEND =====
JWT_SECRET=CHANGE_ME_jwt_secret
QR_SECRET=CHANGE_ME_qr_secret   # ← thêm dòng này
```

### Thao tác trên droplet (thủ công 1 lần)

```bash
ssh root@<DROPLET_IP>
cd ~
nano .env   # hoặc vi .env
```

Thêm dòng (generate secret bằng `openssl rand -hex 32`):
```
QR_SECRET=<chuỗi ngẫu nhiên 64 ký tự>
```

Lưu lại, rồi restart container:
```bash
docker compose -f docker-compose.prod.yml up -d
```

> `docker compose up -d` sẽ tự nhận biến mới từ `.env` và recreate container backend. Không cần `down` trước.

### ⚠️ Lưu ý quan trọng
- `QR_SECRET` phải **GIỐNG nhau** giữa lúc tạo QR và lúc verify QR. Nếu đổi secret sau khi đã in QR, toàn bộ QR cũ sẽ vô hiệu.
- Generate secret bằng: `openssl rand -hex 32`
- Không commit `.env` lên git (đã có trong `.gitignore`)

## 9. Các file liên quan

| File | Vai trò |
|------|---------|
| `src/common/utils/qr.util.ts` | HMAC generate/verify QR |
| `src/auth/dto/auth.dto.ts` | `QrLoginDto`, `GenerateQrDto` |
| `src/auth/auth.service.ts` | `qrLogin()`, `generateQr()` |
| `src/auth/auth.controller.ts` | Route `POST /auth/generate-qr`, `POST /auth/qr-login` |
| `.env` | `QR_SECRET` |

## 10. Lưu ý / Hạn chế

- **QR không hết hạn** — QR dán cố định trên cửa, dùng lâu dài. An toàn vì server vẫn kiểm tra hợp đồng active mỗi lần scan.
- **Không có audit log** — chưa ghi lại ai scan lúc nào. Có thể bổ sung sau khi triển khai thanh toán.
- **Phụ thuộc `QR_SECRET`** — nếu đổi secret, toàn bộ QR cũ vô hiệu, phải tạo lại.