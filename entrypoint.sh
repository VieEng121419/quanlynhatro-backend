#!/bin/sh
set -e

echo "⏳ Đang chờ cơ sở dữ liệu sẵn sàng..."
# Chờ DB khởi động xong (tối đa 90 giây) — dùng Node.js để check TCP (alpine không có nc)
# Lưu ý: trong Docker Compose, DATABASE_HOST = tên service (vd: mysql)
i=0
until node -e "
  const net = require('net');
  const host = process.env.DATABASE_HOST || 'mysql';
  const port = Number(process.env.DATABASE_PORT || 3306);
  const sock = net.connect(port, host);
  sock.on('connect', () => { sock.end(); process.exit(0); });
  sock.on('error', () => process.exit(1));
" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -gt 90 ]; then
    echo "❌ Cơ sở dữ liệu không khả dụng sau 90 giây. Thoát."
    exit 1
  fi
  echo "   ... chờ DB ($i/90)"
  sleep 1
done
echo "✅ Cơ sở dữ liệu đã sẵn sàng!"

echo "⏳ Đang chạy Prisma migrations..."
# `prisma migrate deploy` cần biến DATABASE_URL (connection string)
npx prisma migrate deploy
echo "✅ Migrations hoàn tất!"

echo "🚀 Khởi động backend..."
# Giới hạn heap của Node để tránh vượt mem_limit / gây OOM trên droplet nhỏ (1GB)
# Mặc định là 512nếu không đặt NODE_MAX_OLD_SPACE_SIZE
exec node --max-old-space-size="${NODE_MAX_OLD_SPACE_SIZE:-384}" dist/src/main