import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
// import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  //   @Cron('*/10 * * * * *')
  async handleMonthlyInvoiceGeneration() {
    this.logger.log('Generating monthly invoices...');
    // Logic to generate monthly invoices

    const today = new Date();
    const currentDay = today.getDate();

    const activeContracts = await this.prisma.contract.findMany({
      where: {
        isActive: true,
        billingCycleDay: currentDay,
      },
    });

    this.logger.log(
      `Found ${activeContracts.length} active contracts for invoice generation.`,
    );

    for (const contract of activeContracts) {
      try {
        //Check duplicate invoice
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0,
          23,
          59,
          59,
        );

        const existingInvoice = await this.prisma.invoice.findFirst({
          where: {
            contractId: contract.id,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        });

        if (existingInvoice) {
          this.logger.warn(
            `Invoice already exists for contract ${contract.id} for the current month. Skipping...`,
          );
          continue;
        }

        const lastInvoice = await this.prisma.invoice.findFirst({
          where: { contractId: contract.id },
          orderBy: { createdAt: 'desc' },
        });

        let debtAmount = 0;
        let oldElectric = 0;
        let oldWater = 0;

        if (lastInvoice) {
          oldElectric = lastInvoice.newElectric;
          oldWater = lastInvoice.newWater;

          if (lastInvoice.status !== 'PAID') {
            const total = Number(lastInvoice.totalAmount || 0);
            const paid = Number(lastInvoice.paidAmount || 0);
            if (total > paid) {
              debtAmount = total - paid;
            }
          }
        }

        const pendingTabs = await this.prisma.roomTab.findMany({
          where: {
            invoiceId: null,
            roomId: contract.roomId,
          },
        });

        let totalPendingTabAmount = 0;
        if (pendingTabs.length > 0) {
          totalPendingTabAmount = pendingTabs.reduce(
            (sum, tab) => sum + Number(tab.amount),
            0,
          );
        }

        const fromDate = lastInvoice ? lastInvoice.toDate : contract.startDate;
        const toDate = today;

        const newInvoice = await this.prisma.invoice.create({
          data: {
            contractId: contract.id,
            fromDate,
            toDate,
            oldElectric,
            newElectric: oldElectric,
            oldWater,
            newWater: oldWater,
            debtAmount,
            peopleCountSnapshot: contract.activePeopleCount || 2,
            rentAmount: 0,
            serviceAmount: 0,
            tabAmount: totalPendingTabAmount,
            totalAmount: debtAmount,
            status: 'DRAFT',
          },
        });

        if (pendingTabs.length > 0) {
          await this.prisma.roomTab.updateMany({
            where: {
              id: { in: pendingTabs.map((tab) => tab.id) },
            },
            data: {
              invoiceId: newInvoice.id,
            },
          });
        }
        this.logger.log(`Invoice created for contract ${contract.id}`);
      } catch (error) {
        this.logger.error(
          `Error creating invoice for contract ${contract.id}: ${error}`,
        );
      }
      this.logger.log(`Finished processing contract ${contract.id}`);
    }
  }
}
