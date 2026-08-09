# ---- Dependencies stage ----
FROM node:20-slim AS deps
WORKDIR /app

# bcrypt là native module — cần build tools để biên dịch trên Debian slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder stage ----
FROM node:20-slim AS builder
WORKDIR /app

# prisma.config.ts cần DATABASE_URL để load config (chỉ để generate, không kết nối thật)
ARG DATABASE_URL=mysql://root:root@localhost:3306/quanlynhatro
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client + build NestJS
RUN npx prisma generate && npm run build

# ---- Runner stage ----
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy toàn bộ node_modules từ builder (đã được `prisma generate`) để giữ prisma CLI (chạy migrate deploy khi start)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY package.json ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Lưu ý: KHÔNG dùng USER node vì `prisma migrate deploy` (chạy trong entrypoint)
# cần ghi cache vào home directory — user node có thể không có quyền ghi vào /app,
# gây fail migration khi deploy. Container này chỉ expose port nội bộ nên an toàn.

EXPOSE 3001

CMD ["./entrypoint.sh"]