import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateRoomTabDto } from './dto/create-room-tab.dto';
import { RoomTab } from '@prisma/client';
import { GetRoomsDto } from './dto/get-room-tab.dto';
import { paginate, PrismaQueryOptions } from 'src/common/utils/paginate.util';

@Injectable()
export class RoomTabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

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

    let notification: {
      userId: number;
      title: string;
      message: string;
      referenceId: number | null;
    } | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
      const activeContract = await tx.contract.findFirst({
        where: { roomId, isActive: true },
      });
      const currentInvoice = activeContract
        ? await tx.invoice.findFirst({
            where: {
              contractId: activeContract.id,
              status: { in: ['DRAFT', 'UNPAID'] },
            },
            include: { contract: true },
          })
        : null;
      const targetInvoiceId = currentInvoice?.id ?? null;
      const tabStatus = targetInvoiceId ? 'INVOICED' : 'PENDING';

      const newTab = await tx.roomTab.create({
        data: {
          roomId,
          description,
          amount,
          invoiceId: targetInvoiceId,
          status: tabStatus,
        },
      });

      if (currentInvoice && targetInvoiceId) {
        const updatedTabAmount = Number(currentInvoice.tabAmount) + amount;

        if (currentInvoice.status === 'DRAFT') {
          await tx.invoice.update({
            where: { id: targetInvoiceId },
            data: {
              tabAmount: updatedTabAmount,
            },
          });
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
      if (activeContract?.userId) {
        notification = {
          userId: activeContract.userId,
          title: 'Khoản phát sinh mới',
          message: `${description} giá ${amount.toLocaleString('vi-VN')} VNĐ`,
          referenceId: targetInvoiceId,
        };
        await this.notifications.createForEvent(tx, {
          userId: notification.userId,
          title: notification.title,
          message: notification.message,
          referenceId: targetInvoiceId ?? undefined,
          type: 'ROOM_TAB_CREATED',
          eventKey: `room-tab:${newTab.id}:created`,
        });
      }
      return newTab;
    });
    if (notification)
      void this.notifications.dispatch(notification).catch(() => undefined);
    return result;
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
