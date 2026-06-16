import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class UpdateInvoiceDto {
  @IsNotEmpty({ message: 'Số điện mới không được để trống' })
  @IsInt({ message: 'Số điện mới phải là số nguyên' })
  @Min(0, { message: 'Số điện mới phải lớn hơn hoặc bằng 0' })
  newElectric: number;

  @IsNotEmpty({ message: 'Số nước mới không được để trống' })
  @IsInt({ message: 'Số nước mới phải là số nguyên' })
  @Min(0, { message: 'Số nước mới phải lớn hơn hoặc bằng 0' })
  newWater: number;
}
