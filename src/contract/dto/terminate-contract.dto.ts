import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class TerminateContractDto {
  @IsNotEmpty({ message: 'Số điện cuối không được để trống' })
  @IsNumber()
  finalElectric: number;

  @IsNotEmpty({ message: 'Số nước cuối không được để trống' })
  @IsNumber()
  finalWater: number;

  @IsOptional()
  @IsString()
  terminationReason?: string;
}
