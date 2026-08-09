import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger();

  async create(createContractDto: CreateContractDto) {
    const {
      roomId,
      tenantName,
      tenantPhone,
      startDate,
      endDate,
      rentPrice,
      depositAmount,
      billingCycleDay,
      activePeopleCount,
      basePeopleLimit,
      extraPersonFee,
      userId,
    } = createContractDto;

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng với ID ${roomId}`);
    }

    if (room.status !== 'EMPTY') {
      throw new NotFoundException(`Phòng với ID ${roomId} không trống`);
    }

    return await this.prisma.$transaction(async (prisma) => {
      const contract = await prisma.contract.create({
        data: {
          roomId,
          tenantName,
          tenantPhone,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          rentPrice,
          depositAmount,
          billingCycleDay,
          activePeopleCount: activePeopleCount || 1,
          basePeopleLimit: basePeopleLimit || 2,
          extraPersonFee: extraPersonFee || 0,
          isActive: true,
          userId,
        },
      });

      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'OCCUPIED' },
      });

      return contract;
    });
  }

  async update(id: number, dto: UpdateContractDto) {
    // 1. Kiểm tra xem hợp đồng có tồn tại và đang hoạt động không (id + isActive: true)
    const existingContract = await this.prisma.contract.findFirst({
      where: {
        id,
        isActive: true,
      },
    });

    if (!existingContract) {
      throw new NotFoundException(
        `Không tìm thấy hợp đồng đang hoạt động có ID #${id}`,
      );
    }

    try {
      // 2. Chạy Transaction để đảm bảo tính toàn vẹn dữ liệu giữa Contract và Room
      return await this.prisma.$transaction(async (tx) => {
        // Cập nhật thông tin hợp đồng
        const updatedContract = await tx.contract.update({
          where: { id },
          data: {
            rentPrice: dto.rentPrice,
            depositAmount: dto.depositAmount,
            extraPersonFee: dto.extraPersonFee,
            activePeopleCount: dto.activePeopleCount,
            basePeopleLimit: dto.basePeopleLimit,
            tenantName: dto.tenantName,
            tenantPhone: dto.tenantPhone,
            billingCycleDay: dto.billingCycleDay,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            userId: dto.userId,
            // isActive: dto.isActive,
          },
        });

        // 💡 LOGIC ĐẶC BIỆT: Nếu hợp đồng bị chuyển sang hủy/hết hạn (isActive = false)
        // Thì tự động giải phóng phòng đó về trạng thái EMPTY
        // if (dto.isActive === false) {
        //   await tx.room.update({
        //     where: { id: existingContract.roomId },
        //     data: { status: 'EMPTY' },
        //   });
        // }

        // Ngược lại, nếu kích hoạt lại hợp đồng (isActive = true) thì đưa phòng thành OCCUPIED
        // if (dto.isActive === true) {
        //   await tx.room.update({
        //     where: { id: existingContract.roomId },
        //     data: { status: 'OCCUPIED' },
        //   });
        // }

        return updatedContract;
      });
    } catch (error) {
      console.error('❌ LỖI UPDATE CONTRACT:', error);
      throw new BadRequestException(
        'Cập nhật hợp đồng thất bại, vui lòng kiểm tra lại dữ liệu!',
      );
    }
  }

  async terminate(contractId: number, dto: TerminateContractDto) {
    const { finalElectric, finalWater } = dto;
    const today = new Date();
    this.logger.log('today...', today);

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { room: true },
    });

    if (!contract || !contract.isActive) {
      throw new BadRequestException(
        'Hợp đồng không tồn tại hoặc đã được thanh lý từ trước.',
      );
    }

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { contractId: contract.id },
      orderBy: { toDate: 'desc' },
    });

    const cycleStartDate = lastInvoice
      ? new Date(lastInvoice.toDate)
      : new Date(contract.startDate);

    this.logger.log('cycleStartDate...', cycleStartDate);

    const oldElectric = lastInvoice ? lastInvoice.newElectric : 0;
    const oldWater = lastInvoice ? lastInvoice.newWater : 0;

    if (finalElectric < oldElectric || finalWater < oldWater) {
      throw new BadRequestException(
        `Số điện nước cuối kỳ phải lớn hơn hoặc bằng đầu kỳ (Điện cũ: ${oldElectric}, Nước cũ: ${oldWater})`,
      );
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    // Tính số ngày khách ở thực tế trong chu kỳ này
    const daysOccupied =
      Math.ceil((today.getTime() - cycleStartDate.getTime()) / msPerDay) || 1;

    this.logger.log('daysOccupied...', daysOccupied);
    // Lấy tổng số ngày của tháng hiện tại để chia tỷ lệ cho chuẩn
    const daysInCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();

    const baseRent = Number(contract.rentPrice);
    const proratedRent = Math.round(
      (baseRent / daysInCurrentMonth) * daysOccupied,
    );

    const electricUsage = finalElectric - oldElectric;
    const waterUsage = finalWater - oldWater;
    const electricCost = electricUsage * 4000; // Giả định giá điện 4k
    const waterCost = waterUsage * 15000; // Giả định giá nước 15k
    const totalServiceCost = electricCost + waterCost;

    let debtAmount = 0;
    if (lastInvoice && lastInvoice.status !== 'PAID') {
      debtAmount =
        Number(lastInvoice.totalAmount) - Number(lastInvoice.paidAmount);
    }

    const pendingTabs = await this.prisma.roomTab.findMany({
      where: { roomId: contract.roomId, invoiceId: null },
    });
    const totalTabAmount = pendingTabs.reduce(
      (sum, tab) => sum + Number(tab.amount),
      0,
    );
    //TỔNG CHI PHÍ KHÁCH PHẢI TRẢ CUỐI CÙNG
    const totalBillCost =
      proratedRent + totalServiceCost + totalTabAmount + debtAmount;

    const deposit = Number(contract.depositAmount);
    const finalSettlement = deposit - totalBillCost;

    return await this.prisma.$transaction(async (tx) => {
      const finalInvoice = await tx.invoice.create({
        data: {
          contractId: contract.id,
          fromDate: cycleStartDate,
          toDate: today,
          oldElectric,
          newElectric: finalElectric,
          oldWater,
          newWater: finalWater,
          peopleCountSnapshot: contract.activePeopleCount || 1,
          rentAmount: proratedRent,
          serviceAmount: totalServiceCost,
          debtAmount: debtAmount,
          tabAmount: totalTabAmount,
          totalAmount: totalBillCost,
          status: 'UNPAID', // Chờ xử lý thanh toán sòng phẳng rồi chuyển PAID sau
        },
      });

      if (pendingTabs.length > 0) {
        await tx.roomTab.updateMany({
          where: { id: { in: pendingTabs.map((t) => t.id) } },
          data: { invoiceId: finalInvoice.id, status: 'INVOICED' },
        });
      }

      await tx.contract.update({
        where: { id: contractId },
        data: {
          isActive: false,
          endDate: today,
          // Lưu vết lý do trả phòng nếu muốn
        },
      });

      await tx.room.update({
        where: { id: contract.roomId },
        data: { status: 'EMPTY' },
      });

      return {
        message: 'Thanh lý hợp đồng thành công. Phòng đã được giải phóng.',
        summary: {
          daysOccupied,
          proratedRent,
          totalServiceCost,
          totalTabAmount,
          debtAmount,
          totalBillCost,
          depositAmount: deposit,
          finalSettlement: finalSettlement,
          actionRequired:
            finalSettlement >= 0
              ? `Chủ nhà cần trả lại ${finalSettlement}đ tiền cọc thừa cho khách`
              : `Khách cần đóng thêm ${Math.abs(finalSettlement)}đ mới hoàn tất thủ tục trả phòng`,
        },
        finalInvoiceId: finalInvoice.id,
      };
    });
  }

  async findOne(id: number) {
    // Bốc chi tiết hợp đồng và kéo theo các mối quan hệ liên quan
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
          },
        },
        invoices: {
          select: {
            id: true,
            newElectric: true,
            newWater: true,
          },
        },
      },
    });

    // Nếu không tìm thấy hợp đồng, văng lỗi 404 ngay lập tức
    if (!contract) {
      throw new NotFoundException(`Không tìm thấy hợp đồng có ID #${id}!`);
    }

    return contract;
  }
}
