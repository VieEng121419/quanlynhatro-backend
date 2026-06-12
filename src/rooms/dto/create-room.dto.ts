import { RoomStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRoomDto {
  @IsNotEmpty({ message: 'Room number is required' })
  @IsString({ message: 'Room number must be a string' })
  roomNumber: string;

  @IsNotEmpty({ message: 'Branch ID is required' })
  @IsNumber({}, { message: 'Branch ID must be a number' })
  branchId: number;

  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Status must be a valid enum value' })
  status: RoomStatus;
}
