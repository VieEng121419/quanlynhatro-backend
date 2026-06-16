import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InvoiceCronService } from './invoice-cron.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceCronService],
})
export class InvoiceModule {}
