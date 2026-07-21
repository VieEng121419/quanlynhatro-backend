import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTabDto } from './dto/create-room-tab.dto';
import { Prisma, RoomTab } from '@prisma/client';
import { GetRoomsDto } from './dto/get-room-tab.dto';
import { paginate, PrismaQueryOptions } from 'src/common/utils/paginate.util';

type InvoiceWithContract = Prisma.InvoiceGetPayload<{
  include: { contract: true };
}>;

@Injectable()
export class RoomTabService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoomTabDto) {
    const { roomId, description, amount } = dto;

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException(
        `Không tìm thấy phòng trọ có ID là ${roomId}`,
      );
    }

    const activeContract = await this.prisma.contract.findFirst({
      where: { roomId: roomId, isActive: true },
    });

    let targetInvoiceId: number | null = null;
    let currentInvoice: InvoiceWithContract | null = null;

    if (activeContract) {
      currentInvoice = await this.prisma.invoice.findFirst({
        where: {
          contractId: activeContract.id,
          status: { in: ['DRAFT', 'UNPAID'] },
        },
        include: { contract: true },
      });
      if (currentInvoice) {
        targetInvoiceId = currentInvoice.id;
      }
    }

    const tabStatus = targetInvoiceId ? 'INVOICED' : 'PENDING';

    return await this.prisma.$transaction(async (tx) => {
      const newTab = await tx.roomTab.create({
        data: {
          roomId,
          description,
          amount,
          invoiceId: targetInvoiceId,
          status: tabStatus,
        },
      });

      if (targetInvoiceId && currentInvoice) {
        const updatedTabAmount = Number(currentInvoice.tabAmount) + amount;

        if (currentInvoice.status === 'DRAFT') {
          await tx.invoice.update({
            where: { id: targetInvoiceId },
            data: {
              tabAmount: updatedTabAmount,
            },
          });
          return newTab;
        } else if (currentInvoice.status === 'UNPAID') {
          const updatedTotalAmount =
            Number(currentInvoice.totalAmount) + amount;
          await tx.invoice.update({
            where: { id: targetInvoiceId },
            data: {
              tabAmount: updatedTabAmount,
              totalAmount: updatedTotalAmount,
            },
          });
        }
      }
      return newTab;
    });
  }

  async findAll(query: GetRoomsDto) {
    const { page, limit, search, status } = query;

    const where: PrismaQueryOptions['where'] = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.roomNumber = {
        contains: search,
      };
    }

    return paginate<RoomTab>(
      this.prisma.roomTab,
      {
        where,
        orderBy: { id: 'asc' },
        include: {},
      },
      { page, limit },
    );
  }
}
