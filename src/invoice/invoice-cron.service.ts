import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  // @Cron('*/10 * * * * *')
  async handleMonthlyInvoiceGeneration() {
    const today = new Date();
    const activeContracts = await this.prisma.contract.findMany({
      where: { isActive: true, billingCycleDay: today.getDate() },
    });
    for (const contract of activeContracts) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const startOfMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1,
          );
          const endOfMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            0,
            23,
            59,
            59,
          );
          const existing = await tx.invoice.findFirst({
            where: {
              contractId: contract.id,
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });
          if (existing) return;
          const lastInvoice = await tx.invoice.findFirst({
            where: { contractId: contract.id },
            orderBy: { createdAt: 'desc' },
          });
          const debtAmount =
            lastInvoice && lastInvoice.status !== 'PAID'
              ? Math.max(
                  0,
                  Number(lastInvoice.totalAmount) -
                    Number(lastInvoice.paidAmount),
                )
              : 0;
          const pendingTabs = await tx.roomTab.findMany({
            where: { invoiceId: null, roomId: contract.roomId },
          });
          const tabAmount = pendingTabs.reduce(
            (sum, tab) => sum + Number(tab.amount),
            0,
          );
          const invoice = await tx.invoice.create({
            data: {
              contractId: contract.id,
              fromDate: lastInvoice?.toDate ?? contract.startDate,
              toDate: today,
              oldElectric: lastInvoice?.newElectric ?? 0,
              newElectric: lastInvoice?.newElectric ?? 0,
              oldWater: lastInvoice?.newWater ?? 0,
              newWater: lastInvoice?.newWater ?? 0,
              debtAmount,
              peopleCountSnapshot: contract.activePeopleCount || 2,
              rentAmount: contract.rentPrice,
              serviceAmount: 0,
              tabAmount,
              totalAmount: debtAmount + tabAmount,
              status: 'DRAFT',
            },
          });
          if (pendingTabs.length)
            await tx.roomTab.updateMany({
              where: {
                id: { in: pendingTabs.map((tab) => tab.id) },
                invoiceId: null,
              },
              data: { invoiceId: invoice.id },
            });
        });
      } catch (error) {
        this.logger.error(
          `Error creating invoice for contract ${contract.id}: ${error}`,
        );
      }
    }
  }
}
