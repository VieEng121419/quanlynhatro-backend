import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ChangeStatusDto, InvoiceStatus } from './dto/change-status.dto';

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

  async findOne(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
          },
        },
        // 💡 NẾU MÀY CÓ BẢNG LƯU CHI TIẾT ĐIỆN NƯỚC (Ví dụ đặt tên là InvoiceItem hoặc InvoiceDetail)
        // Thì include nó vào đây để Frontend vẽ ra cái bảng chi tiết tiền
        // items: true
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Không tìm thấy hóa đơn có ID #${id} đâu fency!`,
      );
    }

    return invoice;
  }

  async changeStatus(id: number, dto: ChangeStatusDto) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice)
      throw new NotFoundException(`Không tìm thấy hóa đơn có ID #${id}`);

    const total = invoice.totalAmount.toNumber();
    const paidAmount = dto.paidAmount ?? invoice.paidAmount.toNumber();

    // 1. Reset tiền về 0 nếu FE chủ động chuyển về UNPAID
    if (dto.status === InvoiceStatus.UNPAID) {
      return await this.prisma.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.UNPAID, paidAmount: 0 },
      });
    }

    if (dto.status === InvoiceStatus.CANCELLED) {
      return await this.prisma.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          paidAmount: invoice.paidAmount.toNumber(),
        },
      });
    }

    // 2. Kiểm tra bắt buộc phải có số tiền khi xử lý thanh toán
    if (dto.paidAmount === undefined || dto.paidAmount === null) {
      throw new BadRequestException(
        'Bắt buộc phải kèm theo số tiền thực trả (paidAmount)!',
      );
    }

    // 3. Chặn case gõ nhầm thừa tiền
    if (paidAmount > total) {
      throw new BadRequestException(
        `Số tiền thực trả vượt quá tổng hóa đơn (${total.toLocaleString()}đ)!`,
      );
    }

    // 💡 KHÓA MÕM BUG NGẦM: Bắt buộc Status và Số tiền phải nhất quán tuyệt đối

    // Case trả ĐỦ tiền nhưng FE lại gửi status bậy bạ (ví dụ PARTIAL)
    if (paidAmount === total && dto.status !== InvoiceStatus.PAID) {
      throw new BadRequestException(
        `Dữ liệu không nhất quán! Số tiền đã trả đủ (${paidAmount.toLocaleString()}đ), trạng thái gửi lên bắt buộc phải là PAID.`,
      );
    }

    // Case trả THIẾU tiền nhưng FE lại gửi status là PAID
    if (paidAmount < total && dto.status !== InvoiceStatus.PARTIAL) {
      throw new BadRequestException(
        `Dữ liệu không nhất quán! Số tiền mới trả được ${paidAmount.toLocaleString()}đ / ${total.toLocaleString()}đ, trạng thái gửi lên bắt buộc phải là PARTIAL.`,
      );
    }

    // 4. Nếu vượt qua hết đống lính gác trên -> Dữ liệu sạch 100%, tự tin lưu DB
    return await this.prisma.invoice.update({
      where: { id },
      data: {
        status: dto.status,
        paidAmount: paidAmount,
      },
    });
  }
}
