import { IsOptional, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class GetInvoicesDto {
  @IsNotEmpty({ message: 'Bắt buộc phải truyền contractId' })
  @Type(() => Number)
  @IsNumber()
  contractId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10; // Mặc định lấy 10 tháng gần nhất nếu không truyền
}
