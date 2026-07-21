import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

export enum RoomStatus {
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
}

export class GetRoomsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus; // Lọc theo trạng thái

  @IsOptional()
  @IsString()
  search?: string; // Tìm kiếm theo số phòng
}
