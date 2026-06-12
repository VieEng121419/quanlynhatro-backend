import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractService {
  constructor(private readonly prisma: PrismaService) {}

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
        },
      });

      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'OCCUPIED' },
      });

      return contract;
    });
  }
}
