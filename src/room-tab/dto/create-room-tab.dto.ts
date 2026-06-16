import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsInt,
  IsOptional,
} from 'class-validator';

export class CreateRoomTabDto {
  @IsNotEmpty({ message: 'roomId không được để trống' })
  @IsInt()
  roomId: number;

  @IsNotEmpty({ message: 'Lý do phát sinh không được để trống' })
  @IsString()
  description: string;

  @IsNotEmpty({ message: 'Số tiền không được để trống' })
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsInt()
  invoiceId?: number;
}
