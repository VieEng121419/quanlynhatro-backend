import { IsEnum, IsOptional } from 'class-validator';
import { RoomStatus } from '@prisma/client';

export class UpdateRoomDto {
  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;
}
