import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BranchsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        landlordId: true,
      },
    });
  }
}
