import webpush from 'web-push';
import { NotificationService } from './notification.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('NotificationService', () => {
  const prisma = {
    notification: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    pushSubscription: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'public';
    process.env.VAPID_PRIVATE_KEY = 'private';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
  });

  it('deduplicates event notifications by event key', async () => {
    const service = new NotificationService(prisma);
    await service.createForEvent(prisma, {
      userId: 7,
      title: 't',
      message: 'm',
      type: 'DEBT_CREATED',
      eventKey: 'invoice:1:debt:carried-forward',
      referenceId: 2,
    });
    expect(prisma.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventKey: 'invoice:1:debt:carried-forward' },
        update: {},
      }),
    );
  });

  it('scopes notification reads and mutations to the authenticated tenant', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    const service = new NotificationService(prisma);
    await service.list(7);
    await service.readOne(7, 3);
    await service.readAll(7);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 } }),
    );
    expect(prisma.notification.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 3, userId: 7 },
      data: { isRead: true },
    });
    expect(prisma.notification.updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: 7, isRead: false },
      data: { isRead: true },
    });
  });

  it('scopes push subscription writes and deletion to the tenant', async () => {
    const service = new NotificationService(prisma);
    await service.subscribe(7, {
      endpoint: 'endpoint',
      p256dh: 'key',
      auth: 'auth',
    });
    await service.removeSubscription(7, 'endpoint');
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_endpoint: { userId: 7, endpoint: 'endpoint' } },
      }),
    );
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, endpoint: 'endpoint' },
    });
  });

  it.each([404, 410])(
    'deletes subscriptions on push status %s',
    async (statusCode) => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        { id: 9, endpoint: 'endpoint', p256dh: 'key', auth: 'auth' },
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({ statusCode });
      const service = new NotificationService(prisma);
      await expect(
        service.dispatch({
          userId: 7,
          title: 't',
          message: 'm',
          referenceId: null,
        }),
      ).resolves.toBeUndefined();
      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 9 },
      });
    },
  );

  it('does not throw on non-expired push failure', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([
      { id: 9, endpoint: 'endpoint', p256dh: 'key', auth: 'auth' },
    ]);
    (webpush.sendNotification as jest.Mock).mockRejectedValue({
      statusCode: 500,
    });
    const service = new NotificationService(prisma);
    await expect(
      service.dispatch({
        userId: 7,
        title: 't',
        message: 'm',
        referenceId: null,
      }),
    ).resolves.toBeUndefined();
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });
});
