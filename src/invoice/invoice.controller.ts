import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Patch(':id/counter')
  async updateCounter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
  ) {
    const data = await this.invoiceService.updateCounters(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: 'Cập nhật hoá đơn thành công',
      data,
    };
  }

  @Post(':id/payment')
  async processPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessPaymentDto,
  ) {
    const data = await this.invoiceService.processPayment(id, dto);
    return {
      success: true,
      statusCode: 200,
      message:
        data.status === 'PAID'
          ? 'Hoá đơn đã đã được thanh toán hoàn tất'
          : 'Hoá đơn đã được thành toán một phần, còn lại sẽ được ghi nợ',
      data,
    };
  }

  @Get(':id')
  async getInvoiceDetail(@Param('id', ParseIntPipe) id: number) {
    const result = await this.invoiceService.findOne(id);
    return {
      success: true,
      statusCode: 200,
      message: `Lấy chi tiết hóa đơn #${id} thành công!`,
      data: result,
    };
  }
}
