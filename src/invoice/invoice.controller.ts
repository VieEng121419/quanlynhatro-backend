import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetInvoicesDto } from './dto/get-invoices.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('invoice')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Patch(':id/counter')
  @Roles(Role.ADMIN)
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
  @Roles(Role.ADMIN)
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

  @Get('tenant')
  @Roles(Role.ADMIN, Role.TENANT, Role.STAFF) // Cho phép cả Tenant và Admin test
  async getTenantInvoices(
    @Query() query: GetInvoicesDto,
    @CurrentUser('id') userId: number, // Bốc ID từ Token
  ) {
    const invoices = await this.invoiceService.getTenantInvoices(query, userId);

    return {
      success: true,
      statusCode: 200,
      data: invoices,
    };
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async getInvoiceDetail(@Param('id', ParseIntPipe) id: number) {
    const result = await this.invoiceService.findOne(id);
    return {
      success: true,
      statusCode: 200,
      message: `Lấy chi tiết hóa đơn #${id} thành công!`,
      data: result,
    };
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStatusDto,
  ) {
    const result = await this.invoiceService.changeStatus(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Cập nhật trạng thái hóa đơn #${id} thành công!`,
      data: result,
    };
  }
}
