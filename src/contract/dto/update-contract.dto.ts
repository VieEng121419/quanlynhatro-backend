import {
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  // IsBoolean,
  IsInt,
  Max,
  IsString,
} from 'class-validator';

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  tenantName?: string;

  @IsOptional()
  @IsString()
  tenantPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rentPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  billingCycleDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraPersonFee?: number;

  @IsOptional()
  @IsInt()
  activePeopleCount?: number;

  @IsOptional()
  @IsInt()
  basePeopleLimit?: number;

  // Thanh lý nên tách riêng, không để ở đây
  // @IsOptional()
  // @IsBoolean()
  // isActive?: boolean;
}
