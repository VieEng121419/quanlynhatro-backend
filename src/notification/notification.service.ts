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

  async list(userId: number, limit = 20, cursor?: number) {
    const where = { userId };
    const notifications = await this.prisma.notification.findMany({
      where: { ...where, ...(cursor ? { id: { lt: cursor } } : {}) },
      take: Math.min(limit, 50),
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
    this.logger.log(
      `-----Sending Web Push to ${subscriptions.length} subscriptions`,
    );
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
