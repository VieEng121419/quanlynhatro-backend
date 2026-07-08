import {
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class UpdateContractDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  rentPrice?: number; // Sửa giá thuê thực tế thỏa thuận lại với khách

  @IsNumber()
  @Min(0)
  @IsOptional()
  deposit?: number; // Sửa lại số tiền cọc (nếu khách đóng thêm hoặc rút bớt)

  @IsNumber()
  @Min(0)
  @IsOptional()
  extraPersonFee?: number; // Sửa phụ phí nếu có người dọn vào ở thêm hoặc dời đi

  @IsDateString()
  @IsOptional()
  endDate?: string; // Gia hạn hợp đồng (đổi ngày kết thúc)

  @IsBoolean()
  @IsOptional()
  isActive?: boolean; // Bật/tắt thủ công trạng thái hiệu lực của hợp đồng
}
