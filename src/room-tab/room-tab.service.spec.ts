import { RoomTabService } from './room-tab.service';

describe('RoomTabService notifications', () => {
  const notification = {
    createForEvent: jest.fn(),
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    room: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.room.findUnique.mockResolvedValue({ id: 3 });
    prisma.$transaction.mockImplementation((callback: any) =>
      callback({
        contract: {
          findFirst: jest.fn().mockResolvedValue({ id: 1, userId: 7 }),
        },
        invoice: { findFirst: jest.fn().mockResolvedValue(null) },
        roomTab: {
          create: jest.fn().mockResolvedValue({ id: 9, status: 'PENDING' }),
        },
      }),
    );
  });

  it('notifies tenant only after room-tab creation succeeds', async () => {
    const service = new RoomTabService(prisma, notification as any);
    await service.create({
      roomId: 3,
      description: 'Sửa khóa',
      amount: 120000,
    });
    expect(notification.createForEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 7,
        type: 'ROOM_TAB_CREATED',
        message: 'Sửa khóa giá 120.000 VNĐ',
        eventKey: 'room-tab:9:created',
      }),
    );
  });

  it('does not notify when room-tab creation fails', async () => {
    prisma.$transaction.mockRejectedValue(new Error('create failed'));
    const service = new RoomTabService(prisma, notification as any);
    await expect(
      service.create({ roomId: 3, description: 'Sửa khóa', amount: 120000 }),
    ).rejects.toThrow('create failed');
    expect(notification.createForEvent).not.toHaveBeenCalled();
  });

  it('uses stable room-tab event key for retries', async () => {
    const service = new RoomTabService(prisma, notification as any);
    await service.create({
      roomId: 3,
      description: 'Sửa khóa',
      amount: 120000,
    });
    expect(notification.createForEvent.mock.calls[0][1].eventKey).toBe(
      'room-tab:9:created',
    );
  });
});
