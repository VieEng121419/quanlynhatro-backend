# ---- Dependencies stage ----
FROM node:20-alpine AS deps
WORKDIR /app

# bcrypt là native module — cần build tools để biên dịch trên Alpine
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# prisma.config.ts cần DATABASE_URL để load config (chỉ để generate, không kết nối thật)
ARG DATABASE_URL=mysql://root:root@localhost:3306/quanlynhatro
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client + build NestJS
RUN npx prisma generate && npm run build

# ---- Runner stage ----
FROM node:20-alpine AS runner
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

EXPOSE 3001

CMD ["./entrypoint.sh"]