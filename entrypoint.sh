#!/bin/sh
set -e

echo "⏳ Đang chờ MySQL sẵn sàng..."
# Chờ MySQL khởi động xong (tối đa 60 giây) — dùng Node.js để check TCP (alpine không có nc)
i=0
until node -e "
  const net = require('net');
  const host = process.env.DATABASE_HOST;
  const port = Number(process.env.DATABASE_PORT || 3306);
  const sock = net.connect(port, host);
  sock.on('connect', () => { sock.end(); process.exit(0); });
  sock.on('error', () => process.exit(1));
" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -gt 60 ]; then
    echo "❌ MySQL không khả dụng sau 60 giây. Thoát."
    exit 1
  fi
  echo "   ... chờ MySQL ($i/60)"
  sleep 1
done
echo "✅ MySQL đã sẵn sàng!"

echo "⏳ Đang chạy Prisma migrations..."
npx prisma migrate deploy
echo "✅ Migrations hoàn tất!"

echo "🚀 Khởi động backend..."
exec node dist/src/main
