import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateContractDto {
  @IsNotEmpty({ message: 'ID phòng không được để trống' })
  @IsInt({ message: 'roomId phải là số nguyên' })
  roomId: number;

  @IsNotEmpty({ message: 'Tên khách thuê không được để trống' })
  @IsString({ message: 'Tên khách thuê phải là chuỗi' })
  tenantName: string;

  @IsNotEmpty({ message: 'Số điện thoại khách thuê không được để trống' })
  @IsString({ message: 'Số điện thoại khách thuê phải là chuỗi' })
  tenantPhone: string;

  @IsNotEmpty({ message: 'Ngày bắt đầu hợp đồng không được để trống' })
  startDate: Date;

  @IsOptional()
  endDate: Date;

  @IsNotEmpty({ message: 'Giá thuê không được để trống' })
  @IsNumber({}, { message: 'Giá thuê phải là số' })
  @Min(0, { message: 'Giá thuê phải lớn hơn hoặc bằng 0' })
  rentPrice: number;

  @IsNotEmpty({ message: 'Tiền đặt cọc không được để trống' })
  @IsNumber({}, { message: 'Tiền đặt cọc phải là số' })
  @Min(0, { message: 'Tiền đặt cọc phải lớn hơn hoặc bằng 0' })
  depositAmount: number;

  @IsNotEmpty({ message: 'Ngày chốt sổ không được để trống' })
  @IsInt({ message: 'Ngày chốt sổ phải là số nguyên' })
  @Min(1, { message: 'Ngày chốt sổ phải lớn hơn hoặc bằng 1' })
  @Max(31, { message: 'Ngày chốt sổ phải nhỏ hơn hoặc bằng 31' })
  billingCycleDay: number;

  @IsOptional()
  @IsInt({ message: 'Số người hiện tại phải là số nguyên' })
  activePeopleCount?: number;

  @IsOptional()
  @IsInt({ message: 'basePeopleLimit phải là số nguyên' })
  basePeopleLimit?: number;

  @IsOptional()
  @IsInt({ message: 'Phí người thêm phải là số nguyên' })
  extraPersonFee?: number;
}
