import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class ProcessPaymentDto {
  @IsNotEmpty({ message: 'Số tiền thanh toán không được để trống' })
  @IsNumber({}, { message: 'Số tiền thanh toán phải là số' })
  @Min(0, { message: 'Số tiền thanh toán phải lớn hơn hoặc bằng 0' })
  paidAmount: number;
}
