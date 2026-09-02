import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ChangeStatusDto, InvoiceStatus } from './dto/change-status.dto';
import { GetInvoicesDto } from './dto/get-invoices.dto';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async updateCounters(id: number, dto: UpdateInvoiceDto) {
    const { newElectric, newWater } = dto;

    let notification: {
      userId: number;
      title: string;
      message: string;
      referenceId: number;
    } | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          contract: {
            select: {
              userId: true,
              rentPrice: true,
              basePeopleLimit: true,
              extraPersonFee: true,
            },
          },
        },
      });
      if (!invoice)
        throw new NotFoundException(`Không tìm thấy hóa đơn với ID ${id}`);
      if (newElectric < invoice.oldElectric || newWater < invoice.oldWater)
        throw new BadRequestException(
          'Chỉ số mới không được nhỏ hơn chỉ số cũ',
        );
      const serviceAmount =
        (newElectric - invoice.oldElectric) * 3500 +
        (newWater - invoice.oldWater) * 7000 +
        10000;
      const rentAmount =
        Number(invoice.contract.rentPrice) +
        Math.max(
          0,
          (invoice.peopleCountSnapshot || 1) -
            (invoice.contract.basePeopleLimit || 2),
        ) *
          Number(invoice.contract.extraPersonFee || 0);
      const totalAmount =
        rentAmount +
        serviceAmount +
        Number(invoice.tabAmount || 0) +
        Number(invoice.debtAmount || 0);
      const claimed = await tx.invoice.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          newElectric,
          newWater,
          rentAmount,
          serviceAmount,
          totalAmount,
          status: 'UNPAID',
        },
      });
      if (claimed.count === 0)
        return tx.invoice.findUniqueOrThrow({ where: { id } });
      if (invoice.contract.userId) {
        notification = {
          userId: invoice.contract.userId,
          title: 'Hóa đơn mới',
          message: `Đã có hoá đơn cho tháng ${invoice.toDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}`,
          referenceId: id,
        };
        await this.notifications.createForEvent(tx, {
          ...notification,
          type: 'INVOICE_UNPAID',
          eventKey: `invoice:${id}:status:UNPAID`,
        });
      }
      return tx.invoice.findUniqueOrThrow({ where: { id } });
    });
    if (notification)
      void this.notifications.dispatch(notification).catch(() => undefined);
    return result;
  }

  async processPayment(id: number, dto: ProcessPaymentDto) {
    const { paidAmount } = dto;

    let notification: {
      userId: number;
      title: string;
      message: string;
      referenceId: number;
    } | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { contract: { select: { userId: true } } },
      });
      if (!invoice)
        throw new NotFoundException(`Không tìm thấy hóa đơn với ID ${id}`);
      if (invoice.status === 'DRAFT')
        throw new BadRequestException('Hóa đơn nháp chưa thể thanh toán');
      const currentPaid = Number(invoice.paidAmount || 0);
      const totalAmount = Number(invoice.totalAmount);
      const newTotalPaid = currentPaid + paidAmount;
      if (newTotalPaid > totalAmount)
        throw new BadRequestException(
          'Số tiền thanh toán vượt quá tổng hóa đơn',
        );
      const newStatus = newTotalPaid >= totalAmount ? 'PAID' : 'PARTIAL';
      const claimed = await tx.invoice.updateMany({
        where: { id, status: invoice.status, paidAmount: invoice.paidAmount },
        data: { paidAmount: newTotalPaid, status: newStatus },
      });
      if (claimed.count === 0)
        throw new BadRequestException(
          'Hóa đơn vừa được cập nhật, vui lòng thử lại',
        );
      if (
        invoice.status === 'UNPAID' &&
        newStatus === 'PAID' &&
        invoice.contract.userId
      ) {
        notification = {
          userId: invoice.contract.userId,
          title: 'Thanh toán thành công',
          message: `Đã thanh toán tiền phòng tháng ${invoice.toDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}`,
          referenceId: id,
        };
        await this.notifications.createForEvent(tx, {
          ...notification,
          type: 'INVOICE_PAID',
          eventKey: `invoice:${id}:status:PAID`,
        });
      }
      return tx.invoice.findUniqueOrThrow({ where: { id } });
    });
    if (notification)
      void this.notifications.dispatch(notification).catch(() => undefined);
    return result;
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

  async getTenantInvoices(query: GetInvoicesDto, userId: number) {
    const { contractId, limit = 10 } = query;

    // 1. Kiểm tra xem hợp đồng này có tồn tại và thuộc về User đang request không
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: Number(contractId),
        userId: Number(userId), // Chốt chặn bảo mật: Chỉ cho phép xem hóa đơn của chính mình
      },
    });

    if (!contract) {
      throw new NotFoundException(
        'Không tìm thấy hợp đồng hoặc bạn không có quyền truy cập.',
      );
    }

    // 2. Query lấy N dòng hóa đơn mới nhất của hợp đồng đó
    const invoices = await this.prisma.invoice.findMany({
      where: {
        contractId: Number(contractId),
      },
      take: Number(limit),
      orderBy: {
        createdAt: 'desc', // Lấy row mới nhất lên đầu
      },
      include: {
        contract: {
          select: {
            room: {
              select: { roomNumber: true },
            },
          },
        },
      },
    });

    return invoices;
  }
}
