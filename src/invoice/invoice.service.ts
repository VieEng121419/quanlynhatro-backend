import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async updateCounters(id: number, dto: UpdateInvoiceDto) {
    const { newElectric, newWater } = dto;

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        contract: true,
      },
    });

    if (!invoice) {
      throw new Error(`Không tìm thấy hóa đơn với ID ${id}`);
    }

    if (newElectric < invoice.oldElectric) {
      throw new Error(
        `Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ (${invoice.oldElectric})`,
      );
    }

    if (newWater < invoice.oldWater) {
      throw new Error(
        `Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ (${invoice.oldWater})`,
      );
    }

    const ELECTRIC_PRICE = 3500; // 3.500 đ/kwh
    const WATER_PRICE = 15000; // 15.000 đ/m3

    const electricUsage = newElectric - invoice.oldElectric;
    const electricCost = electricUsage * ELECTRIC_PRICE;
    const waterUsage = newWater - invoice.oldWater;
    const waterCost = waterUsage * WATER_PRICE;

    const serviceAmount = electricCost + waterCost;

    const rentPrice = Number(invoice.contract.rentPrice);
    const peopleLimit = invoice.contract.basePeopleLimit || 2;
    const extraPersonFee = Number(invoice.contract.extraPersonFee || 0);
    const currentPeopleCount = invoice.peopleCountSnapshot || 1;

    let rentAmount = rentPrice;

    if (currentPeopleCount > peopleLimit) {
      const extraPeopleCount = currentPeopleCount - peopleLimit;
      rentAmount += extraPeopleCount * extraPersonFee;
    }

    const tabAmount = Number(invoice.tabAmount || 0);
    const debtAmount = Number(invoice.debtAmount || 0);

    const totalAmount = rentAmount + serviceAmount + tabAmount + debtAmount;

    return await this.prisma.invoice.update({
      where: { id },
      data: {
        newElectric,
        newWater,
        rentAmount,
        serviceAmount,
        totalAmount,
        status: 'UNPAID',
      },
    });
  }

  async processPayment(id: number, dto: ProcessPaymentDto) {
    const { paidAmount } = dto;

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn với ID ${id}`);
    }

    if (invoice.status === 'DRAFT') {
      throw new NotFoundException(
        `Hóa đơn này đang ở dạng nháp (chưa chốt số điện nước), không thể tiến hành thanh toán.`,
      );
    }

    const currentPaid = Number(invoice.paidAmount || 0);
    const newTotalPaid = currentPaid + paidAmount;
    const totalAmount = Number(invoice.totalAmount);

    let newStatus: 'PAID' | 'PARTIAL' = 'PARTIAL';

    if (newTotalPaid >= totalAmount) {
      newStatus = 'PAID';
    }

    return await this.prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newTotalPaid,
        status: newStatus,
      },
    });
  }
}
