import { IsString, IsUrl, Length } from 'class-validator';

export class PushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint!: string;

  @IsString()
  @Length(16, 256)
  p256dh!: string;

  @IsString()
  @Length(8, 256)
  auth!: string;
}
