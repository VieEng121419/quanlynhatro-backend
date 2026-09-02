import { InvoiceCronService } from './invoice-cron.service';

describe('InvoiceCronService', () => {
  it('does not create debt notifications', async () => {
    const createForEvent = jest.fn();
    const tx = {
      invoice: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: 4,
          status: 'UNPAID',
          totalAmount: 100,
          paidAmount: 0,
          newElectric: 0,
          newWater: 0,
          toDate: new Date(),
        }),
        create: jest.fn().mockResolvedValue({ id: 5 }),
      },
      roomTab: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      contract: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 2,
            roomId: 3,
            userId: 7,
            billingCycleDay: new Date().getDate(),
            isActive: true,
            startDate: new Date(),
            rentPrice: 100,
            activePeopleCount: 2,
          },
        ]),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: any) => callback(tx)),
    } as any;
    const service = new InvoiceCronService(prisma, { createForEvent } as any);
    await service.handleMonthlyInvoiceGeneration();
    expect(createForEvent).not.toHaveBeenCalled();
  });
});
