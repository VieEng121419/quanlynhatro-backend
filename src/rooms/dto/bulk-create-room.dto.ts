import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class BulkCreateRoomDto {
  @IsInt()
  @Min(1)
  floorCount: number; // Tổng số tầng (Ví dụ: 3)

  @IsInt()
  @Min(1)
  roomsPerFloor: number; // Số phòng trên mỗi tầng (Ví dụ: 12)

  @IsInt()
  @IsNotEmpty()
  branchId: number; // Id của khu nhà trọ đó
}
