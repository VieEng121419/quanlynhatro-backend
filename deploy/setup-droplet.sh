#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  Setup Droplet cho Backend quanlynhatro (1GB RAM)
#  - Cài Docker + Docker Compose plugin
#  - Thêm swap 2GB (phao cứu sinh cho 1GB RAM)
#  - Tạo file .env mẫu
#
#  Cách dùng:
#    sudo bash setup-droplet.sh
# ============================================================

echo "🚀 Bắt đầu cài đặt môi trường trên droplet..."

# ---------- 1. Thêm swap 2GB (nếu chưa có) ----------
if ! swapon --show | grep -q '/swapfile'; then
  echo "⏳ Tạo swapfile 2GB..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
  echo "✅ Đã tạo swap 2GB."
else
  echo "↪️  Swap đã tồn tại, bỏ qua."
fi

# Tối ưu swappiness cho server (không quá lười dùng swap khi cần)
echo 10 > /proc/sys/vm/swappiness
echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf
echo "✅ Đã đặt swappiness=10."

# ---------- 2. Cài Docker (Ubuntu/Debian) ----------
if ! command -v docker &>/dev/null; then
  echo "⏳ Cài Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  echo "✅ Đã cài Docker."
else
  echo "↪️  Docker đã có, bỏ qua."
fi

# ---------- 3. Cài Docker Compose (plugin 'docker compose' hoặc binary 'docker-compose') ----------
has_compose() {
  # Plugin: `docker compose` (có dấu cách)
  docker compose version &>/dev/null && return 0
  # Binary cũ: `docker-compose` (dấu gạch ngang)
  command -v docker-compose &>/dev/null && return 0
  return 1
}

if ! has_compose; then
  echo "⏳ Cài Docker Compose plugin..."
  apt-get update -y
  if apt-get install -y docker-compose-plugin; then
    echo "✅ Đã cài Docker Compose plugin."
  else
    # Fallback: cài binary standalone nếu apt không có plugin
    echo "⚠️  apt không có plugin, cài binary standalone..."
    DOCKER_COMPOSE_VERSION="v2.29.2"
    curl -SL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "✅ Đã cài docker-compose binary."
  fi
else
  echo "↪️  Docker Compose đã có, bỏ qua."
fi

# ---------- 4. Kiểm tra lại Docker Compose ----------
echo "↪️  Kiểm tra:"
docker compose version 2>/dev/null && echo "  → dùng lệnh: docker compose ..."
docker-compose --version 2>/dev/null && echo "  → dùng lệnh: docker-compose ..."

# ---------- 5. Tạo file .env mẫu ----------
ENVFILE=".env"
if [ ! -f "$ENVFILE" ]; then
  echo "⏳ Tạo file .env mẫu (bạn cần điền giá trị thật)..."
  # Lấy IPv4 công khai của droplet làm IP mặc định cho connection string
  DROPLET_IP=$(curl -s -4 ifconfig.me || echo "127.0.0.1")
  cat > "$ENVFILE" <<EOF
# ===== CẤU HÌNH MYSQL/MARIADB =====
# Mật khẩu root của database (chỉ dung trong container mariadb)
DB_ROOT_PASSWORD=CHANGE_ME_root_password
# Tên database
DB_NAME=quanlynhatro
# User ứng dụng kết nối
DB_USER=app
# Mật khẩu user ứng dụng
DB_PASSWORD=CHANGE_ME_app_password

# ===== CẤU HÌNH BACKEND =====
# Secret cho JWT (bạn tự generate bằng: openssl rand -hex 32)
JWT_SECRET=CHANGE_ME_jwt_secret
# Secret cho QR code (bạn tự generate bằng: openssl rand -hex 32)
QR_SECRET=CHANGE_ME_qr_secret

# ===== GHI CHÚ =====
# Sau khi điền, chạy lệnh pull image và up:
#   docker compose -f docker-compose.prod.yml pull
#   docker compose -f docker-compose.prod.yml up -d
# Kiểm tra log: docker compose -f docker-compose.prod.yml logs -f backend
EOF
  echo "✅ Đã tạo $ENVFILE — NHỚ sửa các giá trị CHANGE_ME trước khi up!"
else
  echo "↪️  Đã có file .env, bỏ qua."
fi

echo ""
echo "======================================================"
echo "✅ HOÀN TẤT! Các bước tiếp theo:"
echo "  1. Sửa file .env (điền DB_ROOT_PASSWORD, DB_PASSWORD, JWT_SECRET)"
echo "  2. docker login ghcr.io -u <username> -p <PAT>"
echo "  3. docker compose -f docker-compose.prod.yml pull"
echo "  4. docker compose -f docker-compose.prod.yml up -d"
echo "  5. docker compose -f docker-compose.prod.yml logs -f backend"
echo "======================================================"