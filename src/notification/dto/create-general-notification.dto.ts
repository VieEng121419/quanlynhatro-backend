import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGeneralNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
