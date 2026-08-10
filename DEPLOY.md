# 🚀 Hướng dẫn triển khai lên DigitalOcean Droplet (1GB)

> Kiến trúc: **GitHub Actions build image → GHCR → Droplet chỉ `pull` + `up`**
> Không build trên droplet (tránh OOM với 1GB RAM).

```
[Mac] git push → [GitHub Actions] build image → [GHCR] → [Droplet] docker compose up
```

---

## ✅ Bước 0 — Kiểm tra workflow build thành công (trước khi đụng droplet)

1. Mở repo trên GitHub → tab **Actions**.
2. Chọn workflow **"Build & Push Backend Image"**.
3. Đợi status **green check ✔**.
4. Vào **Packages** (bên phải repo) → xác nhận package `quanlynhatro-backend` đã tồn tại.

> Nếu workflow fail, bấm vào run để xem log lỗi — dán lại cho tôi nếu cần.

---

## ✅ Bước 1 — SSH vào droplet

```bash
ssh root@<DROPLET_IP>
```

Thay `<DROPLET_IP>` bằng IP thật (VDG trong Digital Ocean console).

---

## ✅ Bước 2 — Copy file deploy lên droplet

Từ **máy Mac** (mở terminal riêng, không phải SSH):

```bash
scp deploy/setup-droplet.sh docker-compose.prod.yml root@<DROPLET_IP>:~/
```

---

## ✅ Bước 3 — Chạy setup (chỉ một lần)

Trên droplet:

```bash
sudo bash ~/setup-droplet.sh
```

Script này tự động:
- Tạo **swap 2GB** (phao cứu sinh cho 1GB RAM)
- Cài **Docker** + **Docker Compose**
- Tạo file **`.env` mẫu** trong `~`

---

## ✅ Bước 4 — Điền thông tin thật vào `.env`

**Trên Mac**, tạo 2 mật khẩu mạnh:

```bash
openssl rand -hex 32   # dùng cho JWT_SECRET
openssl rand -hex 16   # dùng cho DB_ROOT_PASSWORD
openssl rand -hex 16   # dùng cho DB_PASSWORD
```

**Trên droplet**, sửa file:

```bash
nano ~/.env
```

Sửa 3 giá trị `CHANGE_ME...`:

```ini
DB_ROOT_PASSWORD=<mật khẩu root DB>
DB_PASSWORD=<mật khẩu user app>
JWT_SECRET=<secret JWT>
```

> Các giá trị còn lại giữ nguyên. Lưu: `Ctrl+O`, Enter, `Ctrl+X`.

---

## ✅ Bước 5 — Đăng nhập GHCR để pull image

Tạo **Personal Access Token** trên GitHub:
- GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic)** → **Generate new token**
- Chọn scope: `read:packages` (bắt buộc)
- (Nếu repo private, cần thêm `write:packages` nếu muốn push sau này — nhưng workflow dùng `GITHUB_TOKEN` sẵn rồi, nên chỉ cần `read:packages` cho droplet)

Trên droplet:

```bash
docker login ghcr.io -u VieEng121419 -p <TOKEN>
```

> Lưu ý: nếu repo công khai, image GHCR vẫn cần login trừ khi bạn đổi package thành **public**.

---

## ✅ Bước 6 — Kéo image & khởi động

```bash
cd ~
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Lần đầu sẽ:
1. Tạo container `mariadb` + volume dữ liệu
2. Container `backend` chờ MariaDB healthcheck OK
3. Tự chạy `prisma migrate deploy` (tạo bảng từ migrations)
4. Start Node trên port `3001`

---

## ✅ Bước 7 — Kiểm tra hoạt động

```bash
# Xem trạng thái container
docker compose -f docker-compose.prod.yml ps

# Xem log backend (thoát: Ctrl+C)
docker compose -f docker-compose.prod.yml logs -f backend

# Test API ngay trên droplet
curl http://localhost:3001/api/branchs
```

Nếu thấy JSON trả về (dù là lỗi 401/403) nghĩa là backend **đã chạy**.

---

## ✅ Bước 8 — Mở firewall cổng 3001

Droplet mới có thể bật sẵn firewall (UFW hoặc Cloud Firewall của DO):

### Nếu dùng UFW trên droplet:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 3001/tcp
sudo ufw enable
```

### Nếu dùng Cloud Firewall của Digital Ocean:
- Vào **Digital Ocean → Networking → Firewalls**
- Thêm Inbound rule: **Custom → TCP → 3001**
- Apply vào droplet

> Sau đó test từ Mac: `curl http://<DROPLET_IP>:3001/api/branchs`

---

## ⚠️ Bước 9 (khuyên dùng) — Domain + HTTPS bằng Caddy

Chạy API qua HTTP cổng 3001 không có HTTPS. Để có HTTPS tự động, cài **Caddy** trên droplet:

```bash
apt install -y caddy
```

Tạo `/etc/caddy/Caddyfile`:

```
api.tenmiencuaban.com {
    reverse_proxy localhost:3001
}
```

Rồi:

```bash
systemctl restart caddy
```

Caddy tự cấp SSL miễn phí. Sau đó không cần mở port 3001 ra ngoài nữa (chỉ cần 80/443).

---

## 🔄 Cập nhật phiên bản mới

Mỗi lần đổi code:

```bash
# Mac
git add .
git commit -m "update"
git push origin main
```

Đợi workflow xong, rồi trên droplet:

```bash
cd ~
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

> Tự động chạy migration mới (nếu có) trước khi start.

---

## 🛠 Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân / Cách xử lý |
|---|---|
| `pull access denied` khi `docker compose pull` | Chưa login GHCR hoặc token thiếu `read:packages` → làm lại Bước 5 |
| `Error: P1001` không kết nối được DB | MariaDB chưa sẵn sàng; xem log: `docker compose -f docker-compose.prod.yml logs -f mysql` |
| Backend restart liên tục (OOMKilled) | RAM thiếu → kiểm tra `docker stats`; nên có swap như Bước 3; tạm ngừng service khác nếu có |
| Port 3001 không truy cập được từ ngoài | Chưa mở firewall → làm Bước 8 |
| Migration lỗi "table already exists" | Chuỗi migration không khớp DB cũ → dừng, backup volume `mysql_data`, báo tôi |
| Muốn reset toàn bộ DB | ⚠️ Xoá dữ liệu: `docker compose -f docker-compose.prod.yml down -v` rồi `up -d` lại |

---

## 📌 Ghi nhớ các file liên quan

| File | Mục đích |
|---|---|
| `.github/workflows/build-push.yml` | Build & push image lên GHCR khi push `main` |
| `Dockerfile` | Build image production (slim, bcrypt tools) |
| `entrypoint.sh` | Chờ DB → migrate → start Node (heap 384MB) |
| `docker-compose.prod.yml` | Cấu hình backend + mariadb trên droplet |
| `deploy/setup-droplet.sh` | Setup một lần trên droplet (swap, Docker, Compose, `.env`) |