# 🐳 DevOps Guide — Quản Lý Trọ Backend

> File này giải thích **toàn bộ flow deploy** của dự án, cách từng thành phần hoạt động và **vì sao** nó được thiết kế như vậy. Đọc theo thứ tự để hiểu từ đầu đến cuối.

---

## 📌 Tổng quan kiến trúc

```
[Máy Mac]                              [GitHub]                    [DigitalOcean Droplet 1GB]
   |                                        |                             |
   |  git push                             |                             |
   |-------------------------------------->|                             |
   |                                       |  GitHub Actions            |
   |                                       |  (build Docker image)      |
   |                                       |                             |
   |                                       |  push image lên GHCR       |
   |                                       |---------------------------->| (chỉ pull)
   |                                       |                             |
   |                    [SSH]              |                             |
   |<---------------------------------------------------------------------->|
   |    scp compose file / chạy lệnh      |                             |
```

**Ý tưởng cốt lõi:** Code được build thành Docker image **ở GitHub Actions** (không build trên server), rồi đẩy image lên **GHCR** (GitHub Container Registry). Server (droplet) chỉ việc **kéo image về và chạy** → rất nhẹ, không bị nghẽn RAM khi build.

---

## 🔢 Bước 1 — GitHub Actions build image & push lên GHCR

**File:** `.github/workflows/build-push.yml`

### Nó hoạt động thế nào?
Mỗi khi bạn push code lên nhánh `main`, GitHub tự động chạy một "máy ảo tạm" (runner) để thực hiện workflow này.

### Các phần chính:
| Phần | Vai trò |
|---|---|
| `on: push: branches: [main]` | Kích hoạt khi push lên `main` |
| `permissions: packages: write` | Cho phép đẩy image lên GHCR |
| `docker/setup-buildx-action` | Bật BuildKit — công nghệ build Docker nhanh, cache tốt |
| `docker/login-action` | Đăng nhập GHCR bằng token GitHub (GITHUB_TOKEN) |
| `docker/build-push-action` | Thực sự build image rồi push lên GHCR |

### Tag image (nhãn)
```yaml
tags: |
  ghcr.io/vieeng121419/quanlynhatro-backend:latest
  ghcr.io/vieeng121419/quanlynhatro-backend:${{ github.sha }}
```
- `latest` → cho server kéo bản mới nhất.
- `{sha}` → mỗi commit có 1 tag riêng, giúp **quay lại phiên bản cũ** khi cần.

### Build cache
```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```
→ Lần build sau nhanh hơn vì dùng lại layer đã build từ lần trước (không cần `npm ci` lại từ đầu).

---

## 🐳 Bước 2 — Dockerfile: 3 giai đoạn (multi-stage build)

**File:** `Dockerfile`

Multi-stage nghĩa là dùng **nhiều "bộ stage"** để tách việc cài dependency, build, và chạy — giúp image cuối cùng **nhỏ gọn**.

### Stage 1 — `deps` (cài phụ thuộc)
```dockerfile
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y python3 make g++   # bcrypt cần build tools
COPY package.json package-lock.json ./
RUN npm ci
```
- Cài đúng các package trong `package-lock.json` (khóa phiên bản → build xác định, ổn định).
- `bcrypt` là **native module** → cần compiler (g++/python) để biên dịch.

### Stage 2 — `builder` (build code)
```dockerfile
FROM node:20-slim AS builder
COPY --from=deps /app/node_modules ./node_modules   # copy lại node_modules đã cài
COPY . .
RUN npx prisma generate && npm run build
```
- `prisma generate`: sinh ra Prisma Client từ `schema.prisma` (code TypeScript gọi DB qua client này).
- `npm run build`: NestJS chuyển TypeScript → JavaScript (trong `dist/`).

### Stage 3 — `runner` (bản chạy thật)
```dockerfile
FROM node:20-slim AS runner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
CMD ["./entrypoint.sh"]
```
- Chỉ copy những gì **cần để chạy** (không copy source, không copy dev tools) → image nhỏ hơn nhiều.
- Đây là lý do image chạy nhẹ, hợp droplet 1GB RAM.

### ⚠️ Vì sao không dùng `USER node`?
`prisma migrate deploy` (chạy trong entrypoint) cần **ghi cache vào thư mục home**. Nếu chạy bằng user `node`, có thể không có quyền ghi → **migration fail**. Nên để chạy bằng root trong container (chỉ expose port nội bộ nên an toàn).

---

## 🚀 Bước 3 — entrypoint.sh: quy trình khởi động

**File:** `entrypoint.sh`

Đây là lệnh **đầu tiên chạy khi container backend khởi động**. Nó làm 3 việc tuần tự:

### 1. Chờ database sẵn sàng
```sh
until node -e "...check TCP connect..." ; do sleep 1; done
```
- Container backend và mysql khởi động **cùng lúc**. MySQL có thể chưa sẵn sàng ngay.
- Script **ping cổng TCP** của MySQL cho tới khi kết nối được (tối đa 90 giây).

### 2. Chạy migration
```sh
npx prisma migrate deploy
```
- Áp dụng các file `.sql` trong `prisma/migrations` vào database.
- `deploy` khác với `dev` — nó chỉ **chạy migration chưa chạy**, không tạo migration mới. An toàn cho production.

### 3. Khởi động backend với giới hạn bộ nhớ
```sh
exec node --max-old-space-size="${NODE_MAX_OLD_SPACE_SIZE:-384}" dist/src/main
```
- `--max-old-space-size=384`: giới hạn Node dùng tối đa 384MB heap → tránh **OOM** (hết RAM) trên droplet 1GB.
- `exec`: thay thế process hiện tại bằng Node → đúng cách để systemd/Docker quản lý.

---

## 📦 Bước 4 — docker-compose: ghép các service

**File:** `docker-compose.prod.yml`

Compose giúp khai báo **nhiều container** chạy cùng nhau bằng 1 file.

### Hai service

**1. `backend`**
- Dùng image từ GHCR (đã build ở Bước 1).
- `mem_limit: 512m` → giới hạn RAM tối đa 512MB.
- `ports: "3001:3001"` → mở cổng 3001 ra ngoài để app gọi API.
- `depends_on: mysql: condition: service_healthy` → chỉ chạy backend sau khi MySQL **khỏe mạnh**.
- Truyền biến môi trường: `DATABASE_URL`, `DATABASE_HOST`, `JWT_SECRET`, v.v.

**2. `mysql`** (thực chất là MariaDB)
- `mariadb:11` — vì code dùng adapter `@prisma/adapter-mariadb`.
- Cấu hình bộ nhớ nhỏ gọn cho droplet 1GB (`innodb-buffer-pool-size=96M`).
- `healthcheck` → Compose biết khi nào DB "khỏe" để backend bắt đầu.
- `volumes: mysql_data:/var/lib/mysql` → **lưu dữ liệu lâu dài**. Nếu container xóa, dữ liệu vẫn còn trong volume.

### ⭐ Vì sao bind port `127.0.0.1:3306:3306`?
```yaml
ports:
  - "127.0.0.1:3306:3306"
```
- Bind vào **localhost của droplet** (không ra internet) → database **không bị lộ** ra ngoài.
- Để Navicat truy cập: dùng **SSH tunnel** vào droplet rồi connect `127.0.0.1:3306`.

### Giới hạn RAM hợp lý (kinh nghiệm)
- Droplet có 1GB RAM.
- MySQL `mem_limit: 384m` + Backend `mem_limit: 512m` = ~896MB.
- Còn lại ~100MB cho hệ thống. Swap 2GB (tạo trong setup) làm "phao" khi spike.

---

## 🖥️ Bước 5 — setup-droplet.sh: chuẩn bị server

**File:** `deploy/setup-droplet.sh`

Chạy **một lần** trên droplet mới. Nó tự động:

1. **Tạo swap 2GB** — đây là "RAM ảo" trên ổ cứng, dùng khi RAM thật đầy. Cứu droplet 1GB không bị crash.
2. **Đặt swappiness=10** — nói kernel ít dùng swap khi hệ thống còn khỏe.
3. **Cài Docker** — nền tảng chạy container.
4. **Cài Docker Compose plugin** — để dùng lệnh `docker compose`.
5. **Tạo file `.env` mẫu** — nơi chứa mật khẩu/secret.

### Trước/sau setup, ta cần làm gì?
- **Trước:** SSH vào droplet bằng `ssh root@<IP>`.
- **Sau:** sửa `.env` (điền mật khẩu thật), `docker login` GHCR, rồi `docker compose up -d`.

---

## 🌐 Bước 6 — Caddy: HTTPS tự động (reverse proxy)

Caddy là **reverse proxy**: nhận request từ internet (cổng 80/443) và chuyển (proxy) vào backend (port 3001).

### Vì sao cần?
- App cần HTTPS (gọi API an toàn).
- Caddy **tự cấp chứng chỉ SSL miễn phí** (Let's Encrypt) — không cần làm thủ công.

### Cấu hình
```
api.nhatrotuanviet.uk {
    reverse_proxy localhost:3001
}
```
- Khi ai đó vào `https://api.nhatrotuanviet.uk`, Caddy chuyển request tới `localhost:3001` (backend).
- Caddy tự động: cấp chứng chỉ, gia hạn, và phục vụ HTTPS.

### Flow xác thực domain của Let's Encrypt
1. Caddy nói: "Cho tôi chứng chỉ cho domain X".
2. Let's Encrypt kiểm tra: "Bạn có thật sự kiểm soát domain X?" → gửi 1 mã kiểm tra tới cổng 80 của server.
3. Caddy phải trả lời được mã đó → chứng minh sở hữu domain.
4. Nếu firewall **chặn cổng 80** → không trả lời được → **lỗi cấp chứng chỉ**.

> Đây chính là lỗi `Timeout during connect (firewall problem)` bạn gặp — cổng 80 chưa mở.

---

## 🔑 Bước 7 — Cloudflare: DNS + Proxy

Cloudflare vừa **quản lý DNS** (trỏ domain → IP) vừa có thể **proxy** (trung gian).

### DNS record
```
Type: A
Name: api
Value: 178.128.125.255   (IP droplet)
```

### Proxy status — màu cam vs xám
| Trạng thái | Màu | Ý nghĩa |
|---|---|---|
| **Proxied** | 🌙 Cam | Cloudflare đứng giữa, IP hiển thị là IP Cloudflare → **Chặn** request thẳng tới droplet |
| **DNS only** | ⛅ Xám | Cloudflare chỉ trỏ DNS, request đi thẳng tới droplet → cần cái này cho Caddy |

### Lỗi 525 bạn gặp là gì?
- Do record `api` đang **Proxied (cam)**. Cloudflare tự kết nối tới droplet bằng SSL, nhưng Caddy chưa có chứng chỉ → **SSL handshake fail** (525).
- **Cách sửa:** đổi sang **DNS only (xám)** để Caddy tự lo HTTPS.

---

## 🔒 Bước 8 — Firewall (UFW)

Firewall kiểm soát cổng nào được truy cập từ ngoài.

```bash
sudo ufw allow OpenSSH    # cho phép SSH (22)
sudo ufw allow 80/tcp     # HTTP — cần cho Caddy lấy chứng chỉ
sudo ufw allow 443/tcp    # HTTPS — cần để truy cập
sudo ufw allow 3001/tcp   # (tùy) nếu muốn truy cập backend trực tiếp
```

### Vì sao cần mở 80 + 443?
- **80:** Let's Encrypt dùng để xác thực domain (challenge).
- **443:** Caddy phục vụ HTTPS.

Không mở 2 cổng này → Caddy không lấy được chứng chỉ → lỗi SSL.

---

## 🔌 Bước 9 — Kết nối Navicat tới DB production

### Vì sao trước đây fail?
MariaDB trong compose **không có `ports`** → chỉ chạy trong mạng Docker nội bộ. Backend gọi `mysql:3306` được, nhưng Navicat từ máy ngoài **không vào được** → lỗi `2013 Lost connection`.

### Giải pháp: SSH tunnel
Thay vì mở DB ra internet (nguy hiểm), ta **truy cập qua SSH vào droplet**, rồi connect tới `127.0.0.1:3306`.

Navicat > Connection:
- **Tab SSH:** host = IP droplet, user = `root`, port = `22` (auth bằng SSH key/password).
- **Tab General:** host = `127.0.0.1`, port = `3306`, user/password = trong `.env` (ví dụ `app`/`DB_PASSWORD`).

---

## ✅ Tóm tắt flow deploy hoàn chỉnh

```
1. Mac: git push origin main
        ↓
2. GitHub Actions: build Docker image (deps → builder → runner)
        ↓
3. Push image lên GHCR (tag latest + sha)
        ↓
4. SSH vào droplet: scp file + docker compose pull
        ↓
5. docker compose up -d
        ↓
6. Backend container chạy entrypoint.sh:
     - chờ MySQL sẵn sàng
     - prisma migrate deploy
     - node dist/src/main (heap 384MB)
        ↓
7. Caddy nhận request: https://api.domain.uk → localhost:3001
        ↓
8. Backend gọi MariaDB (mysql:3306 nội bộ)
```

---

## 🧠 Khái niệm DevOps bạn nên nắm (từ project này)

| Khái niệm | Giải thích ngắn | Nơi thấy trong dự án |
|---|---|---|
| **Container/Docker** | Đóng gói app + môi trường để chạy nhất quán ở mọi nơi | `Dockerfile`, `docker-compose` |
| **Image** | "Bản snapshot" của app đã đóng gói, có thể kéo về chạy | GHCR |
| **Registry** | Nơi lưu trữ image | GHCR (`ghcr.io/...`) |
| **CI/CD** | Tự động build/test/deploy khi có thay đổi code | GitHub Actions |
| **Multi-stage build** | Dùng nhiều stage để image cuối nhỏ gọn | `Dockerfile` |
| **Volume** | Nơi lưu dữ liệu bền vững ngoài container | `mysql_data` |
| **Reverse proxy** | Trung gian nhận request rồi chuyển vào app | Caddy |
| **SSL/TLS** | Mã hóa truyền thông | Caddy + Let's Encrypt |
| **SSH tunnel** | Đường hầm bảo mật qua SSH để truy cập dịch vụ nội bộ | Navicat → DB |
| **Firewall** | Kiểm soát cổng truy cập mạng | UFW |
| **DNS** | Ánh xạ tên miền → IP | Cloudflare |
| **Swap** | RAM ảo trên ổ cứng, dự phòng khi đầy RAM | setup-droplet.sh |

---

## ⚠️ Lưu ý bảo mật (quan trọng)

1. **Database không bao giờ nên mở ra internet** trực tiếp. Luôn dùng SSH tunnel hoặc VPN.
2. **Secret** (mật khẩu, JWT) đặt trong `.env`, **không commit** lên Git (nằm trong `.gitignore`).
3. `.env` có 3 giá trị phải điền: `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `JWT_SECRET`.
4. Nếu muốn cho người khác biết thêm về repo, luôn kiểm tra không lộ secret.

---

## 🔄 Cập nhật các file liên quan

| File | Mục đích |
|---|---|
| `.github/workflows/build-push.yml` | Build & push image tự động khi push `main` |
| `Dockerfile` | Cách build image (3 stage) |
| `entrypoint.sh` | Quy trình khởi động container backend |
| `docker-compose.prod.yml` | Cấu hình backend + mariadb chạy cùng nhau |
| `deploy/setup-droplet.sh` | Setup droplet một lần (swap, Docker, Compose, .env) |

---

*Tài liệu này được viết để bạn đọc dần và tự kiểm tra lại trên hệ thống thật. Khi bạn đã nắm vững flow này, DevOps còn nhiều phần nâng cao hơn: orchestration (K8s), IaC (Terraform), monitoring (Prometheus/Grafana), logging (Loki/ELK) — nhưng nền tảng đều từ các khái niệm trên.*