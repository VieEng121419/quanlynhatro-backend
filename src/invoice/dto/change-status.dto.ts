import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

// Giả sử mày có Enum InvoiceStatus định nghĩa trong Prisma
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export class ChangeStatusDto {
  @IsEnum(InvoiceStatus)
  @IsNotEmpty()
  status: InvoiceStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  paidAmount?: number;
}
