import { InvoiceService } from './invoice.service';

describe('InvoiceService notification regressions', () => {
  const prisma = {
    $transaction: jest.fn(),
  } as any;
  const notifications = {
    createForEvent: jest.fn(),
    dispatch: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 12,
            status: 'DRAFT',
            oldElectric: 1,
            oldWater: 2,
            peopleCountSnapshot: 2,
            contract: {
              userId: 7,
              rentPrice: 100,
              basePeopleLimit: 2,
              extraPersonFee: 10,
            },
            tabAmount: 0,
            debtAmount: 0,
            paidAmount: 0,
            totalAmount: 100,
            toDate: new Date(2026, 8, 1),
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 12, status: 'UNPAID' }),
        },
      }),
    );
    notifications.createForEvent.mockResolvedValue({});
    notifications.dispatch.mockResolvedValue(undefined);
  });

  it('creates an event notification when DRAFT becomes UNPAID', async () => {
    const service = new InvoiceService(prisma, notifications);
    await service.updateCounters(12, { newElectric: 3, newWater: 4 });
    expect(notifications.createForEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'INVOICE_UNPAID',
        eventKey: 'invoice:12:status:UNPAID',
        userId: 7,
      }),
    );
  });

  it('creates an event notification when UNPAID becomes PAID', async () => {
    const tx = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 12,
          status: 'UNPAID',
          paidAmount: 0,
          totalAmount: 100,
          toDate: new Date(2026, 8, 1),
          contract: { userId: 7 },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 12, status: 'PAID' }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    );
    const service = new InvoiceService(prisma, notifications);
    await service.processPayment(12, { paidAmount: 100 });
    expect(notifications.createForEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'INVOICE_PAID',
        eventKey: 'invoice:12:status:PAID',
      }),
    );
  });

  it('does not reject or undo the transaction when push dispatch fails', async () => {
    notifications.dispatch.mockRejectedValue(new Error('push unavailable'));
    const service = new InvoiceService(prisma, notifications);
    await expect(
      service.updateCounters(12, { newElectric: 3, newWater: 4 } as any),
    ).resolves.toEqual({ id: 12, status: 'UNPAID' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
