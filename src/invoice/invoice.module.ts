import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InvoiceCronService } from './invoice-cron.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceCronService],
})
export class InvoiceModule {}
