import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.room.findMany({
      select: {
        id: true,
        roomNumber: true,
        branchId: true,
        status: true,
      },
    });
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
}
