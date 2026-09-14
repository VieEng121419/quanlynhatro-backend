import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import webpush from 'web-push';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (publicKey && privateKey && subject) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
      } catch {
        this.logger.warn(
          'Web Push configuration is invalid; push delivery disabled',
        );
      }
    }
  }

  async createForEvent(
    tx: Prisma.TransactionClient,
    input: {
      userId: number;
      title: string;
      message: string;
      type: string;
      eventKey: string;
      referenceId?: number;
    },
  ) {
    return tx.notification.upsert({
      where: { eventKey: input.eventKey },
      create: input,
      update: {},
    });
  }

  async dispatch(notification: {
    userId: number;
    title: string;
    message: string;
    referenceId: number | null;
  }) {
    await this.sendPush(notification.userId, notification);
  }

  async createGeneral(title: string, message: string) {
    const contracts = await this.prisma.contract.findMany({
      where: {
        isActive: true,
        userId: { not: null },
        room: { status: { not: 'EMPTY' } },
      },
      select: { userId: true },
    });
    const userIds = [
      ...new Set(
        contracts
          .map((contract) => contract.userId)
          .filter((id): id is number => id !== null),
      ),
    ];
    const created = await Promise.all(
      userIds.map((userId) =>
        this.prisma.notification.create({
          data: {
            userId,
            title,
            message,
            type: 'general',
            eventKey: `general:${createHash('sha256').update(`${userId}:${title}:${message}`).digest('hex')}`,
          },
        }),
      ),
    );
    for (const notification of created) {
      void this.dispatch(notification).catch(() => undefined);
    }
    return { created: created.length };
  }

  async list(userId: number, limit = 20, cursor?: number) {
    const safeLimit = this.positiveInteger(limit, 20);
    const safeCursor = this.positiveInteger(cursor, 0);
    const where = { userId };
    const notifications = await this.prisma.notification.findMany({
      where: {
        ...where,
        ...(safeCursor ? { id: { lt: safeCursor } } : {}),
      },
      take: Math.min(safeLimit, 50),
      orderBy: { id: 'desc' },
    });
    const unreadCount = await this.prisma.notification.count({
      where: { ...where, isRead: false },
    });
    return {
      notifications,
      unreadCount,
      nextCursor: notifications.at(-1)?.id ?? null,
    };
  }

  async history(page = 1, limit = 20, fromDate?: string, toDate?: string) {
    const safePage = this.positiveInteger(page, 1);
    const safeLimit = this.positiveInteger(limit, 20);
    const where = {
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, phoneNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: Math.min(safeLimit, 100),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private positiveInteger(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : fallback;
  }

  unreadCount(userId: number) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }
  readOne(userId: number, id: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }
  readAll(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  subscribe(
    userId: number,
    data: { endpoint: string; p256dh: string; auth: string },
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: data.endpoint } },
      create: { userId, ...data },
      update: data,
    });
  }
  removeSubscription(userId: number, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  private async sendPush(
    userId: number,
    notification: {
      title: string;
      message: string;
      referenceId: number | null;
    },
  ) {
    this.logger.log('VAPID _SUBJECT: ' + process.env.VAPID_SUBJECT);
    if (
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY ||
      !process.env.VAPID_SUBJECT
    )
      return;
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({
              title: notification.title,
              body: notification.message,
              url: notification.referenceId
                ? `/invoices?invoiceId=${notification.referenceId}`
                : '/home',
            }),
          );
          this.logger.log('-----Web Push delivery successful');
        } catch (error: unknown) {
          if (
            (error as { statusCode?: number }).statusCode === 404 ||
            (error as { statusCode?: number }).statusCode === 410
          )
            await this.prisma.pushSubscription.delete({
              where: { id: subscription.id },
            });
          else this.logger.warn('Web Push delivery failed');
        }
      }),
    );
  }
}
