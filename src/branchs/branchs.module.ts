import { Module } from '@nestjs/common';
import { BranchsController } from './branchs.controller';
import { BranchsService } from './branchs.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BranchsController],
  providers: [BranchsService],
})
export class BranchsModule {}
