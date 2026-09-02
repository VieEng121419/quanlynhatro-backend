import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class GetNotificationsDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cursor?: number;
}
