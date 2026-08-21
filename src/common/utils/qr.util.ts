import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.QR_SECRET || 'default-qr-secret-change-me';

export interface QrPayload {
  roomId: number;
  userId: number;
}

/**
 * Tạo chuỗi QR code từ roomId và userId.
 * Format: "roomId:userId:hmac"
 */
export function generateQrCode(roomId: number, userId: number): string {
  const data = `${roomId}:${userId}`;
  const hmac = createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}:${hmac}`;
}

/**
 * Verify chuỗi QR code.
 * Trả về { roomId, userId } nếu hợp lệ, ngược lại trả null.
 */
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
