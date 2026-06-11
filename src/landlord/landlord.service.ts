import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LandlordService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return await this.prisma.landlord.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  }
}
