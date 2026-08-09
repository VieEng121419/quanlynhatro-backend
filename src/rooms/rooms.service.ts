import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { GetRoomsQueryDto } from './dto/get-room.dto';
import {
  paginate,
  PaginatedResult,
  PrismaQueryOptions,
} from 'src/common/utils/paginate.util';
import { Prisma, Room } from '@prisma/client';
import { BulkCreateRoomDto } from './dto/bulk-create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetRoomsQueryDto): Promise<PaginatedResult<Room>> {
    const { page, limit, search, status } = query;

    const where: PrismaQueryOptions['where'] = {};

    if (status) where.status = status;
    if (search) {
      where.roomNumber = { contains: search };
    }

    return paginate<Room>(
      this.prisma.room,
      {
        where,
        orderBy: { roomNumber: 'asc' },
        include: {
          contracts: {
            where: { isActive: true },
            // select: {
            //   id: true,
            //   tenantName: true,
            //   rentPrice: true,
            //   extraPersonFee: true,
            // },
            include: {
              invoices: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  totalAmount: true,
                  oldElectric: true,
                  oldWater: true,
                  newElectric: true,
                  newWater: true,
                  peopleCountSnapshot: true,
                  createdAt: true,
                  status: true,
                  serviceAmount: true,
                  tabAmount: true,
                  debtAmount: true,
                  paidAmount: true,
                  fromDate: true,
                  toDate: true,
                },
              },
            },
          },
        },
      },
      { page, limit },
    );
  }

  async create(createRoomDto: CreateRoomDto) {
    const { roomNumber, branchId, status } = createRoomDto;

    const branchExists = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branchExists) {
      throw new NotFoundException('Branch not found');
    }

    return await this.prisma.room.create({
      data: {
        roomNumber,
        branchId,
        status: status || 'EMPTY',
      },
    });
  }

  async bulkCreate(dto: BulkCreateRoomDto) {
    const { floorCount, roomsPerFloor, branchId } = dto;
    const roomsToCreate: Prisma.RoomCreateInput[] = [];

    // Loop ở Backend để tự sinh số phòng (roomNumber)
    for (let floor = 1; floor <= floorCount; floor++) {
      for (let roomIdx = 1; roomIdx <= roomsPerFloor; roomIdx++) {
        // Định dạng số phòng: tầng 1 + phòng 01 = "101", phòng 10 = "110"
        const roomNumber = `${roomIdx.toString().padStart(2, '0')}`;

        roomsToCreate.push({
          roomNumber,
          status: 'EMPTY',
          branch: {
            connect: { id: branchId },
          },
        });
      }
    }

    try {
      // Dùng $transaction để nạp hàng loạt cực kỳ an toàn
      const result = await this.prisma.$transaction(
        roomsToCreate.map((room) => this.prisma.room.create({ data: room })),
      );

      return {
        count: result.length,
        message: `Đã khởi tạo thành công ${result.length} phòng trọ tự động.`,
      };
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Có lỗi xảy ra khi tạo phòng hàng loạt. Vui lòng kiểm tra lại cấu trúc tầng hoặc trùng số phòng!',
      );
    }
  }

  async update(id: number, dto: UpdateRoomDto) {
    const existingRoom = await this.prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      throw new NotFoundException(`Không tìm thấy phòng trọ có ID #${id}`);
    }

    try {
      const updatedRoom = await this.prisma.room.update({
        where: { id },
        data: {
          status: dto.status,
        },
      });

      return updatedRoom;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Cập nhật thông tin phòng thất bại');
    }
  }
  async getRoomById(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        contracts: {
          where: { isActive: true },
          include: {
            invoices: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                totalAmount: true,
                oldElectric: true,
                oldWater: true,
                newElectric: true,
                newWater: true,
                peopleCountSnapshot: true,
                createdAt: true,
                status: true,
                serviceAmount: true,
                tabAmount: true,
                debtAmount: true,
                paidAmount: true,
                fromDate: true,
                toDate: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng với ID: ${id}`);
    }

    return room;
  }

  async getMyRoom(userId: number) {
    // 1. Tìm hợp đồng đang hoạt động của user
    const contract = await this.prisma.contract.findFirst({
      where: { userId, isActive: true },
    });

    if (!contract) {
      throw new NotFoundException(
        'Bạn chưa có hợp đồng phòng nào đang hoạt động!',
      );
    }

    // 2. Reuse logic getRoomById để trả về room kèm contracts + invoices
    return this.getRoomById(contract.roomId);
  }
}
